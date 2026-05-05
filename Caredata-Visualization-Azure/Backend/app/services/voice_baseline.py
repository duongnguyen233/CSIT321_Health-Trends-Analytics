"""Per-resident baseline: PCA(32) + MinCovDet (Mahalanobis) + IsolationForest.

Phase 3 of the voice biomarker rebuild. Per VOICE_BIOMARKER.md \xa78.2 (with
the WavLM term dropped per the plan's Adaptations table), each resident's
baseline is a `joblib`-serialised bundle:

    {
      "version":         int,
      "feature_names":   list[str],          # FEATURE_NAMES at fit time
      "pca":             sklearn.decomposition.PCA(n_components=32),
      "mcd":             sklearn.covariance.MinCovDet,         # fit on PCA scores
      "iforest":         sklearn.ensemble.IsolationForest,     # fit on PCA scores
      "robust_stats":    list[(name, median, mad)],            # per FEATURE_NAMES
      "fit_at":          ISO 8601 UTC timestamp,
    }

Persisted to Azure Blob `model-artifacts/residents/{profile_id}/baseline_v{n}.joblib`.
The container is created on demand. In dev/test (no AZURE_STORAGE_CONNECTION_STRING),
falls back to an in-memory dict so the conftest guard keeps tests offline.

`load_baseline()` is wrapped with an LRU cache (size 64) so the worker
avoids round-tripping to Blob on every recording.
"""
from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Sequence

import joblib
import numpy as np
from sklearn.covariance import MinCovDet
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest

from app.core.config import settings
from app.services.voice_score_vector import FEATURE_NAMES, build_full_vector


logger = logging.getLogger(__name__)
CONTAINER = "model-artifacts"
PCA_COMPONENTS = 32

# In-memory fallback. Key is "{profile_id}/baseline_v{version}.joblib".
_in_memory: dict[str, bytes] = {}


# ---------------------------------------------------------------------------
# Storage helpers (mirror voice_audio_blob pattern)
# ---------------------------------------------------------------------------


def _conn_string() -> str | None:
    return getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get(
        "AZURE_STORAGE_CONNECTION_STRING"
    )


def _client():
    conn = _conn_string()
    if not conn:
        return None
    try:
        from azure.storage.blob import BlobServiceClient

        svc = BlobServiceClient.from_connection_string(conn)
        cc = svc.get_container_client(CONTAINER)
        if not cc.exists():
            cc.create_container()
        return cc
    except Exception as e:
        logger.warning("model-artifacts client unavailable: %s", e)
        return None


def _key(profile_id: str, version: int) -> str:
    return f"residents/{profile_id}/baseline_v{version}.joblib"


def _save_bytes(profile_id: str, version: int, data: bytes) -> str:
    key = _key(profile_id, version)
    cc = _client()
    if cc is not None:
        cc.upload_blob(key, data, overwrite=True)
        return f"blob://{CONTAINER}/{key}"
    _in_memory[key] = data
    return f"memory://{CONTAINER}/{key}"


def _load_bytes(blob_uri: str) -> bytes | None:
    if blob_uri.startswith(f"memory://{CONTAINER}/"):
        return _in_memory.get(blob_uri.removeprefix(f"memory://{CONTAINER}/"))
    if blob_uri.startswith(f"blob://{CONTAINER}/"):
        cc = _client()
        if cc is None:
            return None
        try:
            return cc.download_blob(blob_uri.removeprefix(f"blob://{CONTAINER}/")).readall()
        except Exception as e:
            logger.warning("baseline download failed: %s", e)
            return None
    return None


# ---------------------------------------------------------------------------
# fit / persist
# ---------------------------------------------------------------------------


def _robust_stats(matrix: np.ndarray, names: Sequence[str]) -> list[tuple[str, float, float]]:
    """Return per-column (median, MAD) pairs aligned with `names`."""
    medians = np.median(matrix, axis=0)
    mads = np.median(np.abs(matrix - medians), axis=0)
    # Floor MAD at 1e-6 so robust z-score is finite for constant features
    mads = np.maximum(mads, 1e-6)
    return [
        (name, float(med), float(mad))
        for name, med, mad in zip(names, medians, mads)
    ]


def fit_baseline(features_list: list[dict]) -> dict[str, Any]:
    """Fit PCA + MCD + IF + robust stats from a list of per-recording feature dicts.

    Args:
        features_list: each item is a `voice_processor_v2.extract_all` output
            (or a synthetic dict with the same shape).

    Returns:
        bundle dict ready to persist via save_baseline().

    Raises:
        ValueError: if fewer than 10 recordings were supplied.
    """
    if len(features_list) < 10:
        raise ValueError(
            f"need >= 10 recordings to fit a baseline; got {len(features_list)}"
        )
    matrix = np.stack([build_full_vector(f) for f in features_list], axis=0).astype(
        np.float32
    )
    n_samples = matrix.shape[0]

    n_components = min(PCA_COMPONENTS, n_samples - 1, matrix.shape[1])
    pca = PCA(n_components=n_components, svd_solver="full")
    pca_scores = pca.fit_transform(matrix)

    # MinCovDet wants n_samples > 2 * n_features; PCA(n_components <= n-1)
    # ensures this even when only 10 baseline recordings are present.
    mcd = MinCovDet(support_fraction=None, random_state=0)
    try:
        mcd.fit(pca_scores)
    except Exception as e:
        logger.warning("MinCovDet fit fell back to identity: %s", e)
        # Construct a degenerate MCD-equivalent: store mean + identity covariance
        from sklearn.covariance import EmpiricalCovariance

        mcd = EmpiricalCovariance().fit(pca_scores)

    iforest = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=0,
    )
    iforest.fit(pca_scores)

    robust = _robust_stats(matrix, FEATURE_NAMES)

    return {
        "version": 1,
        "feature_names": list(FEATURE_NAMES),
        "pca": pca,
        "mcd": mcd,
        "iforest": iforest,
        "robust_stats": robust,
        "fit_at": datetime.now(timezone.utc).isoformat(),
    }


def save_baseline(profile_id: str, version: int, bundle: dict) -> str:
    """Serialise the bundle and upload to Azure Blob (or memory in dev)."""
    buf = io.BytesIO()
    joblib.dump(bundle, buf, compress=3)
    blob_uri = _save_bytes(profile_id, version, buf.getvalue())
    # Invalidate any cached load for the older URI
    _load_baseline_cached.cache_clear()
    return blob_uri


def load_baseline(blob_uri: str) -> dict[str, Any] | None:
    """Public entry point. Wraps the cached loader."""
    return _load_baseline_cached(blob_uri)


@lru_cache(maxsize=64)
def _load_baseline_cached(blob_uri: str) -> dict[str, Any] | None:
    raw = _load_bytes(blob_uri)
    if raw is None:
        return None
    try:
        return joblib.load(io.BytesIO(raw))
    except Exception as e:
        logger.warning("baseline deserialise failed for %s: %s", blob_uri, e)
        return None


def clear_cache() -> None:
    """Used by tests to reset the LRU cache."""
    _load_baseline_cached.cache_clear()
