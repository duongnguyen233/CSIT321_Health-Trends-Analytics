"""Tests for eGeMAPSv02 feature extraction."""
from __future__ import annotations
from pathlib import Path

import numpy as np
import pytest

from app.services import voice_audio
from app.services.voice_features_egemaps import (
    extract_egemaps,
    feature_names,
)


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return voice_audio.load_wav((FIXTURES / name).read_bytes())


def test_feature_names_count_is_88():
    """eGeMAPSv02 functionals = 88 features. If openSMILE ever changes this
    we want to know loudly because downstream code assumes the count."""
    names = feature_names()
    assert len(names) == 88


def test_extract_returns_88_finite_values_for_clean_voice():
    audio, sr = _load("clean_voice_10s.wav")
    feats = extract_egemaps(audio, sr)
    # Strip the housekeeping fields
    name_set = set(feature_names())
    payload = {k: v for k, v in feats.items() if k in name_set}
    assert len(payload) == 88
    for name, v in payload.items():
        assert np.isfinite(v), f"non-finite value for {name}: {v}"


def test_loudness_amean_is_positive_for_clean_voice():
    audio, sr = _load("clean_voice_10s.wav")
    feats = extract_egemaps(audio, sr)
    # The loudness functional aggregate must be > 0 for non-silent input.
    assert feats["loudness_sma3_amean"] > 0


def test_extract_handles_empty_array_gracefully():
    feats = extract_egemaps(np.zeros(0, dtype=np.float32), 16000)
    assert feats["_failed"] is True
    assert feats["_nan_count"] == 88


def test_extract_handles_silence_without_failing():
    """Silence should produce finite numbers (mostly zero), not raise."""
    audio, sr = _load("silence_5s.wav")
    feats = extract_egemaps(audio, sr)
    assert feats["_failed"] is False
    name_set = set(feature_names())
    for name in name_set:
        assert np.isfinite(feats[name])
