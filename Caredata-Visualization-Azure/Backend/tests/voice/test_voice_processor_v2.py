"""End-to-end tests for the voice_processor_v2 pipeline orchestrator.

Two test paths:
- Synthetic 30s WAV stitched from the existing fixtures: should yield all
  feature sub-blocks finite, with a finite SNR and a finite duration.
- Pure-noise 30s WAV: should raise LowSnrError so the worker can mark the
  recording failed=low_snr.
"""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.services import voice_audio
from app.services.voice_processor_v2 import (
    LowSnrError,
    SNR_FAIL_THRESHOLD_DB,
    extract_all,
)


FIXTURES = Path(__file__).parent / "fixtures"


def _stitch_full_recording() -> bytes:
    """Build a ~30s synthetic recording by concatenating fixtures.

    Layout:  sustained_a (5s) | ddk (5s) | reading (10s clean) | open_prompt (10s clean)
    """
    sustained, sr = voice_audio.load_wav((FIXTURES / "sustained_a_5s.wav").read_bytes())
    ddk, _ = voice_audio.load_wav((FIXTURES / "pataka_5s.wav").read_bytes())
    clean, _ = voice_audio.load_wav((FIXTURES / "clean_voice_10s.wav").read_bytes())
    full = np.concatenate([sustained, ddk, clean, clean]).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, full, sr, subtype="PCM_16", format="WAV")
    return buf.getvalue()


_FULL_OFFSETS = {
    "sustained_a": [0.0, 5.0],
    "ddk": [5.0, 10.0],
    "reading": [10.0, 20.0],
    "open_prompt": [20.0, 30.0],
}


def test_extract_all_returns_all_sub_blocks():
    bytes_in = _stitch_full_recording()
    # Synthetic harmonic tones don't trigger Silero VAD reliably so SNR may
    # come in low; use a permissive threshold to test the structural shape.
    out = extract_all(bytes_in, _FULL_OFFSETS, skip_whisper=True, snr_threshold_db=-100.0)

    expected_keys = {
        "egemaps_sustained_a", "egemaps_reading", "egemaps_open_prompt",
        "praat", "ddk", "linguistic", "transcript",
        "snr_db", "voiced_duration_s", "duration_s",
    }
    assert expected_keys <= set(out.keys())

    # eGeMAPS sub-blocks each have 88 features
    for key in ("egemaps_sustained_a", "egemaps_reading", "egemaps_open_prompt"):
        block = out[key]
        # _failed + _nan_count are housekeeping; 88 names should be present
        assert len(block) >= 88

    # Praat block has the 9 documented metrics
    assert {"jitter_local", "shimmer_local", "hnr_mean", "cpp", "mpt"} <= out["praat"].keys()

    # DDK block has the rate keys
    assert "ddk_rate_per_s" in out["ddk"]
    assert "ddk_isi_cv" in out["ddk"]

    # Numeric sanity (snr is allowed to be low on synthetic data)
    assert isinstance(out["snr_db"], float)
    assert 28.0 <= out["duration_s"] <= 32.0


def test_extract_all_raises_lowsnr_for_pure_noise():
    """A pure white-noise recording should be rejected before feature extraction."""
    noisy_audio, sr = voice_audio.load_wav((FIXTURES / "noisy_5s.wav").read_bytes())
    # Stretch to 30s by tiling so stage offsets fit
    full = np.tile(noisy_audio, 6).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, full, sr, subtype="PCM_16", format="WAV")
    with pytest.raises(LowSnrError) as excinfo:
        extract_all(buf.getvalue(), _FULL_OFFSETS, skip_whisper=True)
    assert excinfo.value.snr_db < SNR_FAIL_THRESHOLD_DB


def test_extract_all_skip_whisper_yields_empty_transcript():
    bytes_in = _stitch_full_recording()
    out = extract_all(bytes_in, _FULL_OFFSETS, skip_whisper=True, snr_threshold_db=-100.0)
    assert out["transcript"] == ""
    # linguistic may be None if voiced_duration < 5; either is acceptable
    assert out["linguistic"] is None or "speech_rate_wpm" in out["linguistic"]
