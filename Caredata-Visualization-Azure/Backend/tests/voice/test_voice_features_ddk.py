"""Tests for DDK rate / regularity extraction.

The pataka_5s fixture is synthetic noise bursts at 5 Hz; this is enough
to validate that onset_detect picks up rhythmic energy and the rate
estimator returns a number near the ground truth.
"""
from __future__ import annotations
from pathlib import Path

import numpy as np

from app.services import voice_audio
from app.services.voice_features_ddk import extract_ddk


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return voice_audio.load_wav((FIXTURES / name).read_bytes())


def test_returns_required_keys():
    audio, sr = _load("pataka_5s.wav")
    feats = extract_ddk(audio, sr)
    assert set(feats.keys()) >= {"ddk_rate_per_s", "ddk_isi_cv", "_n_onsets", "_failed"}


def test_pataka_fixture_yields_rate_in_plausible_band():
    """Ground truth rate is 5 syll/sec. The synthetic envelope + librosa's
    onset_detect should find a count compatible with that."""
    audio, sr = _load("pataka_5s.wav")
    feats = extract_ddk(audio, sr)
    assert feats["_failed"] is False
    # With ~25 onsets in 5s expected; allow plenty of slack for synthetic
    # signal characteristics: 2..10 syll/s is acceptable.
    assert 2.0 <= feats["ddk_rate_per_s"] <= 10.0, (
        f"unexpected DDK rate: {feats['ddk_rate_per_s']}, n_onsets={feats['_n_onsets']}"
    )


def test_pataka_isi_cv_is_low_for_regular_cadence():
    """A perfectly regular 5 Hz pattern should have CV close to 0."""
    audio, sr = _load("pataka_5s.wav")
    feats = extract_ddk(audio, sr)
    assert feats["_failed"] is False
    assert feats["ddk_isi_cv"] < 1.0  # generous bound for synthetic data


def test_silence_yields_low_rate_no_failure():
    """Pure silence shouldn't crash. Few or no onsets, near-zero rate."""
    audio, sr = _load("silence_5s.wav")
    feats = extract_ddk(audio, sr)
    assert feats["_failed"] is False
    assert feats["ddk_rate_per_s"] < 1.0


def test_empty_input_returns_failed_sentinel():
    feats = extract_ddk(np.zeros(0, dtype=np.float32), 16000)
    assert feats["_failed"] is True
    assert feats["ddk_rate_per_s"] == 0.0
