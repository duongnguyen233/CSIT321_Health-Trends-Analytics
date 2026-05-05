"""Tests for per-resident baseline fit + persist."""
from __future__ import annotations
import random

import numpy as np
import pytest

from app.services import voice_baseline
from app.services.voice_score_vector import EGEMAPS_ALL, FEATURE_NAMES


@pytest.fixture(autouse=True)
def _clear():
    voice_baseline._in_memory.clear()
    voice_baseline.clear_cache()
    yield
    voice_baseline._in_memory.clear()
    voice_baseline.clear_cache()


def _synthetic_features(seed: int = 0) -> dict:
    """Build a feature dict shaped like voice_processor_v2.extract_all output."""
    rng = random.Random(seed)
    return {
        "egemaps_sustained_a": {
            name: rng.gauss(0.0, 1.0) for name in EGEMAPS_ALL
        },
        "praat": {
            "jitter_local": rng.gauss(0.01, 0.002),
            "jitter_rap": rng.gauss(0.005, 0.001),
            "jitter_ppq5": rng.gauss(0.006, 0.001),
            "shimmer_local": rng.gauss(0.04, 0.005),
            "shimmer_apq3": rng.gauss(0.02, 0.003),
            "shimmer_apq5": rng.gauss(0.025, 0.003),
            "hnr_mean": rng.gauss(20.0, 2.0),
            "cpp": rng.gauss(15.0, 2.0),
            "mpt": rng.gauss(5.0, 0.5),
        },
        "linguistic": {
            "speech_rate_wpm": rng.gauss(120, 10),
            "articulation_rate_wpm": rng.gauss(140, 10),
            "pause_ratio": rng.gauss(0.15, 0.03),
            "n_pauses": rng.randint(3, 8),
            "mean_pause_s": rng.gauss(0.5, 0.1),
            "n_filled_pauses": rng.randint(0, 3),
            "ttr": rng.gauss(0.7, 0.05),
            "idea_density": rng.gauss(0.5, 0.05),
            "n_words": rng.randint(40, 80),
        },
        "ddk": {
            "ddk_rate_per_s": rng.gauss(5.0, 0.3),
            "ddk_isi_cv": rng.gauss(0.1, 0.02),
        },
    }


def test_fit_baseline_requires_at_least_10_recordings():
    feats = [_synthetic_features(i) for i in range(9)]
    with pytest.raises(ValueError):
        voice_baseline.fit_baseline(feats)


def test_fit_baseline_returns_bundle_with_expected_components():
    feats = [_synthetic_features(i) for i in range(14)]
    bundle = voice_baseline.fit_baseline(feats)
    assert bundle["version"] == 1
    assert bundle["feature_names"] == list(FEATURE_NAMES)
    # PCA component count is min(32, n_samples - 1, n_features) = min(32, 13, 108) = 13
    assert bundle["pca"].n_components_ <= 13
    # MCD must expose mahalanobis(); EmpiricalCovariance fallback also has it.
    assert hasattr(bundle["mcd"], "mahalanobis")
    assert hasattr(bundle["iforest"], "score_samples")
    assert len(bundle["robust_stats"]) == len(FEATURE_NAMES)


def test_fit_baseline_with_lots_of_samples_uses_full_32_components():
    """When we have well above 32 samples, n_components_ should saturate at 32."""
    feats = [_synthetic_features(i) for i in range(60)]
    bundle = voice_baseline.fit_baseline(feats)
    assert bundle["pca"].n_components_ == 32


def test_save_then_load_round_trips():
    feats = [_synthetic_features(i) for i in range(14)]
    bundle = voice_baseline.fit_baseline(feats)
    uri = voice_baseline.save_baseline("P-test", 1, bundle)
    assert uri.startswith("memory://model-artifacts/") or uri.startswith("blob://")

    loaded = voice_baseline.load_baseline(uri)
    assert loaded is not None
    assert loaded["version"] == 1
    assert len(loaded["robust_stats"]) == len(FEATURE_NAMES)


def test_load_unknown_uri_returns_none():
    assert voice_baseline.load_baseline("memory://model-artifacts/nope.joblib") is None


def test_lru_cache_avoids_redownload():
    """Second load_baseline() call should hit the LRU cache."""
    feats = [_synthetic_features(i) for i in range(14)]
    bundle = voice_baseline.fit_baseline(feats)
    uri = voice_baseline.save_baseline("P-test", 1, bundle)

    voice_baseline.clear_cache()
    voice_baseline.load_baseline(uri)
    info_before = voice_baseline._load_baseline_cached.cache_info()
    voice_baseline.load_baseline(uri)
    info_after = voice_baseline._load_baseline_cached.cache_info()
    assert info_after.hits > info_before.hits


def test_robust_stats_floor_prevents_zero_mad():
    """Constant features should produce mad>=1e-6 so downstream z-scores are
    finite."""
    feats = []
    for i in range(12):
        f = _synthetic_features(i)
        # Force one Praat key to be constant across all recordings
        f["praat"]["mpt"] = 5.0
        feats.append(f)
    bundle = voice_baseline.fit_baseline(feats)
    by_name = {name: (med, mad) for name, med, mad in bundle["robust_stats"]}
    _, mad = by_name["praat.mpt"]
    # Float32 rounds 1e-6 to ~9.9999997e-7; assert a slightly slacker floor
    # to confirm the floor was applied (not zero).
    assert mad > 1e-7
