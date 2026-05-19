"""Local faster-whisper wrapper (CTranslate2 INT8 base.en).

Replaces the legacy OpenAI Whisper HTTP path. Model files live under
`Backend/models/faster-whisper-base.en/` (downloaded by
`scripts/download_voice_models.py`). The first call lazy-loads the model
(~30s on cold start, ~2 GB peak RAM).

If the model directory is missing, `whisper_available()` returns False
and `transcribe()` raises WhisperModelMissingError so the caller can
gracefully degrade (skip the open-prompt linguistic features rather
than crash the whole pipeline).
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import numpy as np


logger = logging.getLogger(__name__)


class WhisperModelMissingError(RuntimeError):
    """Raised when the local Whisper model directory is absent or empty."""


_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_MODEL_DIR = _BACKEND_DIR / "models" / "faster-whisper-base.en"

_model_cache: dict[str, object] = {}


def _model_dir() -> Path:
    override = os.environ.get("VOICE_WHISPER_MODEL_DIR")
    return Path(override) if override else DEFAULT_MODEL_DIR


def whisper_available() -> bool:
    """Return True if the model dir exists and is non-empty."""
    md = _model_dir()
    return md.exists() and any(md.iterdir())


def _load_model():
    if "model" not in _model_cache:
        if not whisper_available():
            raise WhisperModelMissingError(
                f"faster-whisper model not found at {_model_dir()}. "
                "Run `python scripts/download_voice_models.py`."
            )
        from faster_whisper import WhisperModel

        _model_cache["model"] = WhisperModel(
            str(_model_dir()),
            device="cpu",
            compute_type="int8",
            cpu_threads=2,
            num_workers=1,
        )
    return _model_cache["model"]


def transcribe(audio: np.ndarray, sr: int = 16000, beam_size: int = 1) -> dict[str, Any]:
    """Transcribe a mono float32 array.

    Returns:
        {
          "text": full concatenated transcript,
          "words": [{"start": float, "end": float, "word": str}, ...],
          "language": str,
        }
    """
    if audio.size == 0:
        return {"text": "", "words": [], "language": "en"}

    model = _load_model()
    segments_iter, info = model.transcribe(
        audio.astype(np.float32),
        beam_size=beam_size,
        language="en",
        word_timestamps=True,
        vad_filter=False,  # we run VAD ourselves earlier in the pipeline
    )
    text_parts: list[str] = []
    words: list[dict[str, Any]] = []
    for seg in segments_iter:
        text_parts.append(seg.text)
        if seg.words:
            for w in seg.words:
                words.append({
                    "start": float(w.start),
                    "end": float(w.end),
                    "word": w.word,
                })
    return {
        "text": "".join(text_parts).strip(),
        "words": words,
        "language": getattr(info, "language", "en"),
    }
