"""Tests for voice_score.score_recording."""
from __future__ import annotations
import random

import numpy as np
import pytest

from app.services import voice_baseline
from app.services.voice_score import score_recording
from app.services.voice_score_vector import DIMENSIONS, EGEMAPS_PHONATORY, FEATURE_NAMES
from tests.voice.test_voice_baseline import _synthetic_features


@pytest.fixture(autouse=True)
def _clear_baseline():
    voice_baseline._in_memory.clear()
    voice_baseline.clear_cache()
    yield
    voice_baseline._in_memory.clear()
    voice_baseline.clear_cache()


@pytest.fixture
def baseline_bundle():
    feats = [_synthetic_features(i) for i in range(20)]
    return voice_baseline.fit_baseline(feats)


def test_score_returns_required_keys(baseline_bundle):
    feats = _synthetic_features(seed=999)
    out = score_recording(feats, baseline_bundle)
    assert {"concern_score", "mahalanobis", "iforest", "subscores", "feature_deltas"} <= set(out)
    assert set(out["subscores"].keys()) == set(DIMENSIONS)


def test_concern_score_in_zero_to_hundred(baseline_bundle):
    out = score_recording(_synthetic_features(seed=42), baseline_bundle)
    assert 0.0 <= out["concern_score"] <= 100.0
    for dim, s in out["subscores"].items():
        assert 0.0 <= s <= 100.0


def test_near_baseline_yields_low_concern(baseline_bundle):
    """A recording that came from the same distribution as baseline should
    score modestly. Allow up to 60 because the fit is on only 20 synthetic
    samples and PCA-space distances can be variable."""
    out = score_recording(_synthetic_features(seed=21), baseline_bundle)
    assert out["concern_score"] < 60.0


def test_drifted_phonatory_features_lift_phonatory_subscore(baseline_bundle):
    """If we shift Praat phonatory features by 5 MADs the phonatory
    sub-score should be in the high band (>50)."""
    feats = _synthetic_features(seed=7)
    # Push every Praat key to 5 MADs above baseline median
    for name, median, mad in baseline_bundle["robust_stats"]:
        if name.startswith("praat."):
            key = name.removeprefix("praat.")
            feats["praat"][key] = median + 5.0 * mad

    out = score_recording(feats, baseline_bundle)
    assert out["subscores"]["phonatory"] > 50.0, out["subscores"]


def test_feature_deltas_are_finite(baseline_bundle):
    feats = _synthetic_features(seed=3)
    out = score_recording(feats, baseline_bundle)
    for name, z in out["feature_deltas"].items():
        assert np.isfinite(z), f"non-finite delta for {name}: {z}"


def test_score_handles_non_finite_inputs(baseline_bundle):
    feats = _synthetic_features(seed=11)
    feats["praat"]["jitter_local"] = float("nan")
    feats["praat"]["shimmer_local"] = float("inf")
    out = score_recording(feats, baseline_bundle)
    assert np.isfinite(out["concern_score"])
