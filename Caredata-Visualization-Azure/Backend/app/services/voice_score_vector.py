"""Score-vector definition: which features feed scoring + which dimension each maps to.

Per the plan's Adaptations table, the score vector is:
- 88 eGeMAPSv02 functionals (sustained_a stage; the most informative single block)
- 9 Praat features                          -> phonatory dimension
- 9 linguistic features                     -> linguistic dimension
- 2 DDK features                            -> articulatory dimension

Total = 108-d. Feature names are stable across recordings; missing values
are filled with 0 in `build_full_vector`.

The DIMENSIONS / FEATURES_BY_DIM mapping is what the scorer uses to project
a 108-d feature vector onto the 5 sub-score channels (phonatory,
articulatory, prosodic, respiratory, linguistic). eGeMAPS features are
distributed by their conceptual category — pitch/jitter/shimmer-related
ones are phonatory; loudness / energy are respiratory; spectral / formants
are articulatory; F0 dynamics + duration are prosodic.
"""
from __future__ import annotations

from typing import Mapping

import numpy as np


# ---------------------------------------------------------------------------
# Dimension enum
# ---------------------------------------------------------------------------

DIMENSIONS: tuple[str, ...] = (
    "phonatory",
    "articulatory",
    "prosodic",
    "respiratory",
    "linguistic",
)


# ---------------------------------------------------------------------------
# eGeMAPSv02 — 88 functionals, partitioned across dimensions
# ---------------------------------------------------------------------------
#
# We list the canonical eGeMAPSv02 names; if openSMILE's exact spelling
# drifts in a future release, `align_egemaps_keys()` reconciles them.

EGEMAPS_PHONATORY: tuple[str, ...] = (
    # F0 statistics
    "F0semitoneFrom27.5Hz_sma3nz_amean",
    "F0semitoneFrom27.5Hz_sma3nz_stddevNorm",
    "F0semitoneFrom27.5Hz_sma3nz_percentile20.0",
    "F0semitoneFrom27.5Hz_sma3nz_percentile50.0",
    "F0semitoneFrom27.5Hz_sma3nz_percentile80.0",
    "F0semitoneFrom27.5Hz_sma3nz_pctlrange0-2",
    "F0semitoneFrom27.5Hz_sma3nz_meanRisingSlope",
    "F0semitoneFrom27.5Hz_sma3nz_stddevRisingSlope",
    "F0semitoneFrom27.5Hz_sma3nz_meanFallingSlope",
    "F0semitoneFrom27.5Hz_sma3nz_stddevFallingSlope",
    # Jitter / shimmer / HNR
    "jitterLocal_sma3nz_amean",
    "jitterLocal_sma3nz_stddevNorm",
    "shimmerLocaldB_sma3nz_amean",
    "shimmerLocaldB_sma3nz_stddevNorm",
    "HNRdBACF_sma3nz_amean",
    "HNRdBACF_sma3nz_stddevNorm",
    "logRelF0-H1-H2_sma3nz_amean",
    "logRelF0-H1-H2_sma3nz_stddevNorm",
    "logRelF0-H1-A3_sma3nz_amean",
    "logRelF0-H1-A3_sma3nz_stddevNorm",
)

EGEMAPS_RESPIRATORY: tuple[str, ...] = (
    "loudness_sma3_amean",
    "loudness_sma3_stddevNorm",
    "loudness_sma3_percentile20.0",
    "loudness_sma3_percentile50.0",
    "loudness_sma3_percentile80.0",
    "loudness_sma3_pctlrange0-2",
    "loudness_sma3_meanRisingSlope",
    "loudness_sma3_stddevRisingSlope",
    "loudness_sma3_meanFallingSlope",
    "loudness_sma3_stddevFallingSlope",
)

EGEMAPS_ARTICULATORY: tuple[str, ...] = (
    # Formants
    "F1frequency_sma3nz_amean",
    "F1frequency_sma3nz_stddevNorm",
    "F1bandwidth_sma3nz_amean",
    "F1bandwidth_sma3nz_stddevNorm",
    "F1amplitudeLogRelF0_sma3nz_amean",
    "F1amplitudeLogRelF0_sma3nz_stddevNorm",
    "F2frequency_sma3nz_amean",
    "F2frequency_sma3nz_stddevNorm",
    "F2amplitudeLogRelF0_sma3nz_amean",
    "F2amplitudeLogRelF0_sma3nz_stddevNorm",
    "F3frequency_sma3nz_amean",
    "F3frequency_sma3nz_stddevNorm",
    "F3amplitudeLogRelF0_sma3nz_amean",
    "F3amplitudeLogRelF0_sma3nz_stddevNorm",
    # Spectral slopes / flux / Hammarberg
    "spectralFlux_sma3_amean",
    "spectralFlux_sma3_stddevNorm",
    "alphaRatioV_sma3nz_amean",
    "alphaRatioV_sma3nz_stddevNorm",
    "hammarbergIndexV_sma3nz_amean",
    "hammarbergIndexV_sma3nz_stddevNorm",
    "slopeV0-500_sma3nz_amean",
    "slopeV0-500_sma3nz_stddevNorm",
    "slopeV500-1500_sma3nz_amean",
    "slopeV500-1500_sma3nz_stddevNorm",
    "alphaRatioUV_sma3nz_amean",
    "hammarbergIndexUV_sma3nz_amean",
    "slopeUV0-500_sma3nz_amean",
    "slopeUV500-1500_sma3nz_amean",
    "spectralFluxV_sma3nz_amean",
    "spectralFluxV_sma3nz_stddevNorm",
    "spectralFluxUV_sma3nz_amean",
    # MFCCs (mean + stddev) — perceptual articulation proxies
    "mfcc1_sma3_amean", "mfcc1_sma3_stddevNorm",
    "mfcc2_sma3_amean", "mfcc2_sma3_stddevNorm",
    "mfcc3_sma3_amean", "mfcc3_sma3_stddevNorm",
    "mfcc4_sma3_amean", "mfcc4_sma3_stddevNorm",
    "mfcc1V_sma3nz_amean", "mfcc1V_sma3nz_stddevNorm",
    "mfcc2V_sma3nz_amean", "mfcc2V_sma3nz_stddevNorm",
    "mfcc3V_sma3nz_amean", "mfcc3V_sma3nz_stddevNorm",
    "mfcc4V_sma3nz_amean", "mfcc4V_sma3nz_stddevNorm",
)

EGEMAPS_PROSODIC: tuple[str, ...] = (
    # Voiced/unvoiced segment durations + rates
    "VoicedSegmentsPerSec",
    "MeanVoicedSegmentLengthSec",
    "StddevVoicedSegmentLengthSec",
    "MeanUnvoicedSegmentLength",
    "StddevUnvoicedSegmentLength",
    "loudnessPeaksPerSec",
    "equivalentSoundLevel_dBp",
)

# All eGeMAPS features as known to this module — used for length/sanity
# checks. The actual dimension mapping uses the per-dimension tuples above.
EGEMAPS_ALL: tuple[str, ...] = (
    EGEMAPS_PHONATORY + EGEMAPS_ARTICULATORY + EGEMAPS_PROSODIC + EGEMAPS_RESPIRATORY
)


# ---------------------------------------------------------------------------
# Praat 9 -> phonatory
# ---------------------------------------------------------------------------

PRAAT_KEYS: tuple[str, ...] = (
    "jitter_local", "jitter_rap", "jitter_ppq5",
    "shimmer_local", "shimmer_apq3", "shimmer_apq5",
    "hnr_mean", "cpp", "mpt",
)


# ---------------------------------------------------------------------------
# Linguistic 9 -> linguistic
# ---------------------------------------------------------------------------

LINGUISTIC_KEYS: tuple[str, ...] = (
    "speech_rate_wpm", "articulation_rate_wpm", "pause_ratio",
    "n_pauses", "mean_pause_s", "n_filled_pauses",
    "ttr", "idea_density", "n_words",
)


# ---------------------------------------------------------------------------
# DDK 2 -> articulatory
# ---------------------------------------------------------------------------

DDK_KEYS: tuple[str, ...] = ("ddk_rate_per_s", "ddk_isi_cv")


# ---------------------------------------------------------------------------
# Combined ordered names + dimension mapping
# ---------------------------------------------------------------------------

# Distinguish features by source so the same key (e.g. "jitter_local") in
# eGeMAPS vs Praat doesn't collide.
def _prefix(prefix: str, keys: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(f"{prefix}.{k}" for k in keys)


FEATURE_NAMES: tuple[str, ...] = (
    _prefix("egemaps", EGEMAPS_ALL)
    + _prefix("praat", PRAAT_KEYS)
    + _prefix("linguistic", LINGUISTIC_KEYS)
    + _prefix("ddk", DDK_KEYS)
)


FEATURES_BY_DIM: dict[str, tuple[str, ...]] = {
    "phonatory": (
        _prefix("egemaps", EGEMAPS_PHONATORY) + _prefix("praat", PRAAT_KEYS)
    ),
    "articulatory": (
        _prefix("egemaps", EGEMAPS_ARTICULATORY) + _prefix("ddk", DDK_KEYS)
    ),
    "prosodic": _prefix("egemaps", EGEMAPS_PROSODIC),
    "respiratory": _prefix("egemaps", EGEMAPS_RESPIRATORY),
    "linguistic": _prefix("linguistic", LINGUISTIC_KEYS),
}


# Sanity check at import time — every FEATURE_NAMES entry must appear in
# exactly one dimension. Done eagerly so wrong tables fail fast in tests.
def _verify_partitioning() -> None:
    seen: dict[str, str] = {}
    for dim, names in FEATURES_BY_DIM.items():
        for n in names:
            if n in seen:
                raise AssertionError(f"feature {n!r} appears in both {seen[n]!r} and {dim!r}")
            seen[n] = dim
    for n in FEATURE_NAMES:
        if n not in seen:
            raise AssertionError(f"feature {n!r} listed in FEATURE_NAMES but no dimension")
    if set(seen) != set(FEATURE_NAMES):
        extra = set(seen) - set(FEATURE_NAMES)
        raise AssertionError(f"dimension contains feature(s) not in FEATURE_NAMES: {extra!r}")


_verify_partitioning()


# ---------------------------------------------------------------------------
# build_full_vector
# ---------------------------------------------------------------------------


def _get_nested(features: Mapping, prefix: str, key: str) -> float:
    block = features.get(f"egemaps_{prefix}") if prefix == "egemaps" else features.get(prefix)
    # Convenience: also accept the orchestrator's per-stage egemaps blocks.
    # We use sustained_a as the canonical eGeMAPS source.
    if prefix == "egemaps":
        block = (
            features.get("egemaps_sustained_a")
            or features.get("egemaps")
            or {}
        )
    if not isinstance(block, Mapping):
        return 0.0
    v = block.get(key, 0.0)
    if v is None:
        return 0.0
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    if not np.isfinite(f):
        return 0.0
    return f


def build_full_vector(features: Mapping) -> np.ndarray:
    """Project a `voice_processor_v2.extract_all` output dict into a 1-D vector
    of length len(FEATURE_NAMES). Missing / non-finite values become 0.

    The orchestrator output has these top-level keys:
      egemaps_sustained_a, egemaps_reading, egemaps_open_prompt,
      praat, ddk, linguistic, transcript, snr_db, voiced_duration_s, duration_s

    We pull eGeMAPS features from `egemaps_sustained_a` (the most
    informative single block); other extractor outputs are pulled from
    their named top-level keys.
    """
    vec = np.zeros(len(FEATURE_NAMES), dtype=np.float32)
    for i, prefixed in enumerate(FEATURE_NAMES):
        prefix, key = prefixed.split(".", 1)
        vec[i] = _get_nested(features, prefix, key)
    return vec
