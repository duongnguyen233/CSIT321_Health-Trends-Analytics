"""Tests for the Praat feature extractor.

Note: the sustained_a fixture is a synthetic harmonic tone with mild
deliberate jitter+shimmer, so we expect Praat to return finite values
(not the all-NaN failure sentinel) and meaningful HNR/CPP/MPT.
"""
from __future__ import annotations
from pathlib import Path

import numpy as np
import pytest

from app.services import voice_audio
from app.services.voice_features_praat import KEYS, extract_praat


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return voice_audio.load_wav((FIXTURES / name).read_bytes())


def test_returns_all_nine_keys_plus_meta():
    audio, sr = _load("sustained_a_5s.wav")
    feats = extract_praat(audio, sr)
    for k in KEYS:
        assert k in feats, f"missing key {k!r}"
    assert "_failed" in feats
    assert "_nan_count" in feats


def test_succeeds_on_synthetic_sustained_a():
    audio, sr = _load("sustained_a_5s.wav")
    feats = extract_praat(audio, sr)
    assert feats["_failed"] is False
    # All numeric values finite (post-clean)
    for k in KEYS:
        assert np.isfinite(feats[k]), f"{k} non-finite: {feats[k]}"


def test_hnr_is_high_for_clean_sustained_tone():
    audio, sr = _load("sustained_a_5s.wav")
    feats = extract_praat(audio, sr)
    # Synthetic harmonic tone with tiny noise floor -> HNR should be very
    # high (>5 dB threshold from spec; usually > 20 here).
    assert feats["hnr_mean"] > 5.0


def test_mpt_at_least_one_second_for_5s_sustained_input():
    audio, sr = _load("sustained_a_5s.wav")
    feats = extract_praat(audio, sr)
    # 5 seconds of sustained tone should yield MPT >= 1.0 s
    assert feats["mpt"] >= 1.0


def test_failure_sentinel_for_empty_input():
    feats = extract_praat(np.zeros(0, dtype=np.float32), 16000)
    assert feats["_failed"] is True
    assert feats["_nan_count"] == 9
    for k in KEYS:
        assert feats[k] == 0.0


def test_does_not_raise_on_silence():
    """Praat is fragile on silence; we want graceful fallback, not a crash."""
    audio, sr = _load("silence_5s.wav")
    feats = extract_praat(audio, sr)
    # Either succeeds with mostly zeros or returns the failed sentinel —
    # both are acceptable; what matters is no exception leaked.
    assert isinstance(feats, dict)
    for k in KEYS:
        assert k in feats
