"""eGeMAPSv02 functional features via openSMILE.

The Extended Geneva Minimalistic Acoustic Parameter Set (Eyben et al. 2016)
exposes 88 paralinguistic functionals — F0 stats, jitter, shimmer, HNR,
spectral slopes, MFCC stats, formant frequencies, etc. We pull the full set
on each per-stage segment and store as a dict suitable for the JSONB-style
features column.

Usage:

    feats = extract_egemaps(audio_array, sr=16000)
    # -> {<88 feature_name keys>, '_nan_count': int}

NaN values are scrubbed with `np.nan_to_num(value, nan=0.0)` before
returning, but the raw NaN count is preserved under `_nan_count` so the
scoring layer can distinguish "real zero" from "extractor failed".
"""
from __future__ import annotations

import logging

import numpy as np


logger = logging.getLogger(__name__)


_extractor_cache: dict[str, object] = {}


def _extractor():
    """Lazy-load opensmile.Smile(eGeMAPSv02, Functionals); cached per process."""
    if "smile" not in _extractor_cache:
        import opensmile

        _extractor_cache["smile"] = opensmile.Smile(
            feature_set=opensmile.FeatureSet.eGeMAPSv02,
            feature_level=opensmile.FeatureLevel.Functionals,
        )
    return _extractor_cache["smile"]


def feature_names() -> list[str]:
    """Return the 88 eGeMAPSv02 functional feature names."""
    smile = _extractor()
    return list(smile.feature_names)


def extract_egemaps(audio: np.ndarray, sr: int = 16000) -> dict:
    """Extract eGeMAPSv02 functionals from a mono float32 array.

    Returns a dict of 88 features + an `_nan_count` field. If extraction
    fails entirely (e.g. zero-length input), returns all-zero values and
    `_failed=True`.
    """
    smile = _extractor()
    if audio.size == 0:
        names = list(smile.feature_names)
        return {name: 0.0 for name in names} | {"_nan_count": len(names), "_failed": True}

    audio_f32 = audio.astype(np.float32)
    try:
        df = smile.process_signal(audio_f32, sr)
    except Exception as e:
        logger.warning("eGeMAPS extraction failed: %s", e)
        names = list(smile.feature_names)
        return {name: 0.0 for name in names} | {"_nan_count": len(names), "_failed": True}

    row = df.iloc[0]
    nan_count = int(row.isna().sum())
    cleaned = {
        name: float(np.nan_to_num(row[name], nan=0.0, posinf=0.0, neginf=0.0))
        for name in row.index
    }
    cleaned["_nan_count"] = nan_count
    cleaned["_failed"] = False
    return cleaned
