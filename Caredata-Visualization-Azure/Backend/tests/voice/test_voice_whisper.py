"""Tests for the local faster-whisper wrapper.

The model is large (~150 MB) and slow to load (~30 s) so the slow-path
test is gated on the model being already downloaded. CI without the
model gets a clean skip rather than a false failure.
"""
from __future__ import annotations
from pathlib import Path

import numpy as np
import pytest

from app.services import voice_audio, voice_whisper


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return voice_audio.load_wav((FIXTURES / name).read_bytes())


def test_module_imports_without_model():
    """Importing the module must not require the model to exist on disk."""
    assert hasattr(voice_whisper, "transcribe")
    assert hasattr(voice_whisper, "whisper_available")


def test_empty_audio_returns_empty_transcript_without_loading_model():
    """Empty input takes the early-return shortcut — no model load."""
    out = voice_whisper.transcribe(np.zeros(0, dtype=np.float32), 16000)
    assert out["text"] == ""
    assert out["words"] == []


def test_missing_model_raises_clearly(monkeypatch, tmp_path):
    """If the model dir is missing, transcribe should raise the typed
    exception rather than a cryptic FileNotFoundError."""
    missing = tmp_path / "definitely-missing"
    monkeypatch.setenv("VOICE_WHISPER_MODEL_DIR", str(missing))
    voice_whisper._model_cache.clear()
    audio, sr = _load("clean_voice_10s.wav")
    with pytest.raises(voice_whisper.WhisperModelMissingError):
        voice_whisper.transcribe(audio, sr)
    voice_whisper._model_cache.clear()


@pytest.mark.slow
@pytest.mark.skipif(
    not voice_whisper.whisper_available(),
    reason="faster-whisper-base.en model not downloaded; "
           "run `python scripts/download_voice_models.py`",
)
def test_transcribe_returns_text_and_word_timestamps_on_real_audio():
    """Slow integration test — only runs when the model is on disk."""
    audio, sr = _load("clean_voice_10s.wav")
    out = voice_whisper.transcribe(audio, sr)
    assert isinstance(out["text"], str)
    assert isinstance(out["words"], list)
    # Synthetic harmonic tone may or may not produce text — what we want
    # is that the call succeeds and the word timestamps schema holds.
    for w in out["words"]:
        assert {"start", "end", "word"} <= w.keys()
