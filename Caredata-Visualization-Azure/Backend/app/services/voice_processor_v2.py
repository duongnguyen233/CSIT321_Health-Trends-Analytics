"""End-to-end feature pipeline (Phase 2).

Replaces the legacy pure-Python `voice_processor.extract_acoustic_features`.
Per VOICE_BIOMARKER.md \xa78, the pipeline is:

    audio_bytes
      |
      v
    transcode_to_wav (ffmpeg or soundfile fallback)
      |
      v
    load_wav -> (np.ndarray, sr=16000)
      |
      v
    vad_segments + compute_snr_db
      |
      +--- if SNR < 6 dB -> raise LowSnrError (worker marks recording failed)
      |
      v
    split_stages -> {sustained_a, ddk, reading, open_prompt}
      |
      +-- sustained_a -> Praat (jitter/shimmer/HNR/CPP/MPT) + eGeMAPS
      +-- ddk         -> DDK rate + ISI CV
      +-- reading     -> eGeMAPS
      +-- open_prompt -> Whisper (transcript + word timestamps)
                          |
                          +-> linguistic features (when voiced >= 5s)
                         eGeMAPS (always)
      |
      v
    combined dict with sub-blocks {egemaps_*, praat, ddk, linguistic, transcript, snr_db, voiced_duration_s}
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.services import voice_audio
from app.services.voice_features_ddk import extract_ddk
from app.services.voice_features_egemaps import extract_egemaps
from app.services.voice_features_linguistic import extract_linguistic
from app.services.voice_features_praat import extract_praat
from app.services import voice_whisper


logger = logging.getLogger(__name__)


SNR_FAIL_THRESHOLD_DB = 6.0


class LowSnrError(RuntimeError):
    """Raised when SNR is below the configured floor (recording rejected)."""

    def __init__(self, snr_db: float):
        super().__init__(f"SNR too low: {snr_db:.2f} dB (threshold {SNR_FAIL_THRESHOLD_DB} dB)")
        self.snr_db = snr_db


def _voiced_total_seconds(voiced_segments: list[tuple[float, float]]) -> float:
    return float(sum(end - start for start, end in voiced_segments))


def extract_all(
    audio_bytes: bytes,
    stage_offsets: dict,
    *,
    skip_whisper: bool = False,
    snr_threshold_db: float = SNR_FAIL_THRESHOLD_DB,
) -> dict[str, Any]:
    """Run the full pipeline on a single recording's raw audio bytes.

    Args:
        audio_bytes: WebM/Opus/WAV/etc as received by /api/voice/v2/upload.
        stage_offsets: dict of {stage_id: [start_s, end_s]} for the 4 required stages.
        skip_whisper: when True, the transcript is left empty and linguistic
            features are skipped. Used by callers that don't have the model
            available locally (graceful degradation).

    Returns:
        A dict with sub-blocks:
            {
              'egemaps_sustained_a': {...88 keys...},
              'egemaps_reading':     {...88 keys...},
              'egemaps_open_prompt': {...88 keys...},
              'praat':               {...9 keys...},
              'ddk':                 {ddk_rate_per_s, ddk_isi_cv, ...},
              'linguistic':          {...9 keys...} or None,
              'transcript':          str,
              'snr_db':              float,
              'voiced_duration_s':   float,
              'duration_s':          float,
            }

    Raises:
        LowSnrError: if SNR is below SNR_FAIL_THRESHOLD_DB.
    """
    # 1. Transcode + load
    wav_bytes = voice_audio.transcode_to_wav(audio_bytes)
    audio, sr = voice_audio.load_wav(wav_bytes)
    duration_s = float(audio.size / sr) if sr else 0.0

    # 2. VAD + SNR
    voiced = voice_audio.vad_segments(audio, sr)
    snr_db = voice_audio.compute_snr_db(audio, sr, voiced=voiced)
    voiced_duration_s = _voiced_total_seconds(voiced)
    if snr_db < snr_threshold_db:
        raise LowSnrError(snr_db)

    # 3. Split stages
    stages = voice_audio.split_stages(audio, sr, stage_offsets)

    # 4. Per-stage extraction
    egemaps_sa = extract_egemaps(stages["sustained_a"], sr)
    egemaps_rd = extract_egemaps(stages["reading"], sr)
    egemaps_op = extract_egemaps(stages["open_prompt"], sr)

    praat = extract_praat(stages["sustained_a"], sr)
    ddk = extract_ddk(stages["ddk"], sr)

    transcript = ""
    words: list[dict] = []
    if not skip_whisper and voice_whisper.whisper_available():
        try:
            wh = voice_whisper.transcribe(stages["open_prompt"], sr)
            transcript = wh.get("text", "")
            words = wh.get("words", [])
        except Exception as e:
            logger.warning("Whisper transcription failed: %s", e)
    elif skip_whisper:
        logger.info("Skipping Whisper transcription (skip_whisper=True)")
    else:
        logger.info("Whisper model unavailable; skipping transcript + linguistic features")

    open_prompt_voiced = _voiced_total_seconds(
        [
            (max(0.0, start - stage_offsets["open_prompt"][0]),
             min(stages["open_prompt"].size / sr, end - stage_offsets["open_prompt"][0]))
            for start, end in voiced
            if end > stage_offsets["open_prompt"][0]
            and start < stage_offsets["open_prompt"][1]
        ]
    )

    linguistic = extract_linguistic(
        transcript=transcript,
        words=words,
        duration_s=stages["open_prompt"].size / sr if sr else 0.0,
        voiced_duration_s=open_prompt_voiced,
    )

    return {
        "egemaps_sustained_a": egemaps_sa,
        "egemaps_reading": egemaps_rd,
        "egemaps_open_prompt": egemaps_op,
        "praat": praat,
        "ddk": ddk,
        "linguistic": linguistic,
        "transcript": transcript,
        "snr_db": snr_db,
        "voiced_duration_s": voiced_duration_s,
        "duration_s": duration_s,
    }
