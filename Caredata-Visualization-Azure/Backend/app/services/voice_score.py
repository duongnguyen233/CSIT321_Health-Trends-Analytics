"""Per-recording scoring against a per-resident baseline.

Adapts VOICE_BIOMARKER.md \xa78.2 (with the WavLM term dropped per the plan's
Adaptations table). Inputs:

    score_recording(features, baseline) -> {
        concern_score : float in [0, 100],
        mahalanobis   : float (raw distance in PCA space),
        iforest       : float (raw -score_samples),
        subscores     : { dim -> float in [0, 100] for 5 dims },
        feature_deltas: { feature_name -> robust_z (median-/MAD-based) },
    }

The concern score combines two anomaly signals:
- Mahalanobis distance in PCA space, normalised by chi-square CDF
- IsolationForest score, mapped via sigmoid

Both are squashed and combined; the result is then mapped to 0-100 via
tanh so it never saturates the visual scale.

Sub-scores are computed per dimension by taking the maximum |robust_z|
across that dimension's features, mapped 0-100 via tanh-of-(z/3).
"""
from __future__ import annotations

import math
from typing import Mapping

import numpy as np
from scipy.stats import chi2

from app.services.voice_score_vector import (
    DIMENSIONS,
    FEATURES_BY_DIM,
    FEATURE_NAMES,
    build_full_vector,
)


def _sigmoid(x: float) -> float:
    if x > 50:
        return 1.0
    if x < -50:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def _normalise_chi2(distance: float, df: int) -> float:
    """Map a Mahalanobis-squared distance to [0, 1] via the chi-square CDF.

    A distance equal to the median expected value of a chi-square with `df`
    degrees of freedom returns ~0.5; values much larger approach 1.
    """
    if df <= 0 or not np.isfinite(distance):
        return 0.0
    return float(chi2.cdf(distance, df))


def _robust_z(features: Mapping, robust_stats: list) -> dict[str, float]:
    """Compute the robust z-score (|x - median| / MAD) per feature."""
    feat_vec = build_full_vector(features)
    deltas: dict[str, float] = {}
    for (name, median, mad), value in zip(robust_stats, feat_vec):
        if mad <= 0:
            mad = 1e-6
        z = (float(value) - float(median)) / float(mad)
        if not np.isfinite(z):
            z = 0.0
        deltas[name] = z
    return deltas


def _subscore_for_dimension(
    dim: str, deltas: dict[str, float]
) -> float:
    names = FEATURES_BY_DIM.get(dim, ())
    if not names:
        return 0.0
    abs_z = [abs(deltas.get(name, 0.0)) for name in names]
    peak = max(abs_z) if abs_z else 0.0
    # tanh(z/3)*100: z=0 -> 0; z=3 -> 73; z=6 -> 99
    return float(math.tanh(peak / 3.0) * 100.0)


def score_enrolment_preview(features: Mapping) -> dict:
    """Pre-baseline display scores from raw features (not vs personal baseline).

    Lets the nurse dashboard show meaningful sub-scores while the resident
    is still in the enrolment window (before lock-baseline). concern_score
    stays 0 until a baseline exists.
    """
    deltas = {name: float(v) for name, v in zip(FEATURE_NAMES, build_full_vector(features))}
    subscores = {dim: _subscore_for_dimension(dim, deltas) for dim in DIMENSIONS}
    return {
        "concern_score": 0.0,
        "mahalanobis": None,
        "iforest": None,
        "subscores": {k: float(v) for k, v in subscores.items()},
        "feature_deltas": {},
        "enrolment_preview": True,
    }


def score_recording(
    features: Mapping,
    baseline: Mapping,
) -> dict:
    """Score a single recording's features against the resident's baseline."""
    pca = baseline["pca"]
    mcd = baseline["mcd"]
    iforest = baseline["iforest"]
    robust_stats = baseline["robust_stats"]

    full_vec = build_full_vector(features).reshape(1, -1)
    pca_score = pca.transform(full_vec)
    n_components = pca_score.shape[1]

    # MinCovDet.mahalanobis returns squared distance.
    try:
        mahal = float(mcd.mahalanobis(pca_score)[0])
    except Exception:
        mahal = 0.0
    if not np.isfinite(mahal):
        mahal = 0.0

    try:
        iforest_raw = float(-iforest.score_samples(pca_score)[0])
    except Exception:
        iforest_raw = 0.0
    if not np.isfinite(iforest_raw):
        iforest_raw = 0.0

    deltas = _robust_z(features, robust_stats)
    subscores = {dim: _subscore_for_dimension(dim, deltas) for dim in DIMENSIONS}

    chi2_term = _normalise_chi2(mahal, df=n_components)
    iforest_term = _sigmoid(iforest_raw)
    combined = 0.5 * chi2_term + 0.5 * iforest_term
    concern = float(math.tanh(combined * 1.5) * 100.0)
    concern = max(0.0, min(100.0, concern))

    return {
        "concern_score": concern,
        "mahalanobis": mahal,
        "iforest": iforest_raw,
        "subscores": {k: float(v) for k, v in subscores.items()},
        "feature_deltas": deltas,
    }
