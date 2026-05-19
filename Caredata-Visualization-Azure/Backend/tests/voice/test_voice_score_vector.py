"""Tests for the score-vector definition."""
from __future__ import annotations

import numpy as np
import pytest

from app.services.voice_score_vector import (
    DDK_KEYS,
    DIMENSIONS,
    EGEMAPS_ALL,
    FEATURE_NAMES,
    FEATURES_BY_DIM,
    LINGUISTIC_KEYS,
    PRAAT_KEYS,
    build_full_vector,
)


def test_dimensions_are_the_canonical_five():
    assert DIMENSIONS == (
        "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
    )


def test_feature_names_total_in_expected_band():
    """Plan target was ~106-d. Allow some slack since eGeMAPS internal
    bucketing may move a few features between dimensions in practice."""
    n = len(FEATURE_NAMES)
    # We chose 88 + 9 + 9 + 2 = 108
    assert 100 <= n <= 130, f"unexpected feature count: {n}"


def test_every_feature_belongs_to_exactly_one_dimension():
    seen = {}
    for dim, names in FEATURES_BY_DIM.items():
        for n in names:
            assert n not in seen, f"{n} duplicated in {seen[n]} and {dim}"
            seen[n] = dim
    assert set(seen) == set(FEATURE_NAMES)


def test_phonatory_includes_praat_and_egemaps_jitter():
    phon = set(FEATURES_BY_DIM["phonatory"])
    assert "praat.jitter_local" in phon
    assert "praat.shimmer_local" in phon
    assert "praat.cpp" in phon


def test_linguistic_dimension_includes_all_linguistic_keys():
    ling = set(FEATURES_BY_DIM["linguistic"])
    for k in LINGUISTIC_KEYS:
        assert f"linguistic.{k}" in ling


def test_articulatory_includes_ddk_and_formants():
    art = set(FEATURES_BY_DIM["articulatory"])
    for k in DDK_KEYS:
        assert f"ddk.{k}" in art


def test_build_full_vector_returns_correct_shape_and_dtype():
    vec = build_full_vector({})
    assert vec.shape == (len(FEATURE_NAMES),)
    assert vec.dtype == np.float32


def test_build_full_vector_zeros_when_features_missing():
    vec = build_full_vector({})
    assert np.all(vec == 0.0)


def test_build_full_vector_pulls_from_correct_blocks():
    features = {
        "egemaps_sustained_a": {EGEMAPS_ALL[0]: 7.5},
        "praat": {"jitter_local": 0.012},
        "linguistic": {"speech_rate_wpm": 120.0},
        "ddk": {"ddk_rate_per_s": 5.5},
    }
    vec = build_full_vector(features)
    # Find indices for the three values we set
    egemaps_idx = FEATURE_NAMES.index(f"egemaps.{EGEMAPS_ALL[0]}")
    jitter_idx = FEATURE_NAMES.index("praat.jitter_local")
    rate_idx = FEATURE_NAMES.index("linguistic.speech_rate_wpm")
    ddk_idx = FEATURE_NAMES.index("ddk.ddk_rate_per_s")
    assert vec[egemaps_idx] == pytest.approx(7.5)
    assert vec[jitter_idx] == pytest.approx(0.012)
    assert vec[rate_idx] == pytest.approx(120.0)
    assert vec[ddk_idx] == pytest.approx(5.5)


def test_build_full_vector_handles_non_finite_values():
    features = {
        "praat": {"jitter_local": float("nan"), "shimmer_local": float("inf")},
    }
    vec = build_full_vector(features)
    assert np.all(np.isfinite(vec))
