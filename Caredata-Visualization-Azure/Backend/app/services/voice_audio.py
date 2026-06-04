"""Audio I/O + voice-activity detection + stage splitting.

This module is the front end of the voice biomarker feature pipeline.
Inputs are browser-captured WebM/Opus uploads; the canonical internal
format is 16 kHz mono float32 (or PCM s16le when written to WAV).

The four exported helpers (per VOICE_BIOMARKER.md \xa78):

- transcode_to_wav     : WebM/anything -> 16k mono PCM WAV bytes
                         (delegates to `ffmpeg`; falls back to soundfile
                         when ffmpeg is unavailable AND the input is
                         already PCM/WAV)
- load_wav             : decode WAV bytes -> (np.ndarray float32, 16000)
- vad_segments         : Silero VAD -> list[(start_s, end_s)] of voiced spans
- compute_snr_db       : 20*log10(rms_voiced / rms_silence) clipped at 60 dB
- split_stages         : carve a long array into the 4 named stages

Lazy-singletons live at the bottom (Silero model). Tests skip cleanly when
ffmpeg is missing rather than failing.
"""
from __future__ import annotations

import io
import logging
import math
import shutil
import subprocess
from typing import Mapping

import numpy as np
import soundfile as sf


logger = logging.getLogger(__name__)

TARGET_SR = 16000

REQUIRED_STAGES: tuple[str, ...] = ("sustained_a", "ddk", "reading", "open_prompt")


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class FFmpegError(RuntimeError):
    """Raised when ffmpeg fails (non-zero exit, missing binary, decode error)."""


class MissingStageError(ValueError):
    """`stage_offsets` did not contain one of the 4 required stages."""


class InvalidStageOffsetError(ValueError):
    """A stage range was negative, decreasing, or out of bounds for the array."""


# ---------------------------------------------------------------------------
# 1. transcode + load
# ---------------------------------------------------------------------------


def ffmpeg_available() -> bool:
    """Return True if ffmpeg is on PATH (cached)."""
    return shutil.which("ffmpeg") is not None


def transcode_to_wav(input_bytes: bytes, target_sr: int = TARGET_SR) -> bytes:
    """Convert any audio input bytes to 16 kHz mono PCM s16le WAV bytes.

    Three-tier decoder:
      1. system ffmpeg via subprocess piping (fastest when available)
      2. PyAV (`av` package) — bundles libav, decodes WebM/Opus/MP4/etc
         without requiring ffmpeg on PATH. This is the primary path on
         Windows machines where the user hasn't run `winget install
         Gyan.FFmpeg`.
      3. soundfile/libsndfile direct decode for WAV/FLAC/OGG inputs.

    Raises FFmpegError if all three fail.
    """
    # Tier 1: system ffmpeg
    if ffmpeg_available():
        try:
            res = subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-y", "-i", "pipe:0",
                    "-ac", "1", "-ar", str(target_sr),
                    "-acodec", "pcm_s16le",
                    "-f", "wav", "pipe:1",
                ],
                input=input_bytes,
                capture_output=True,
                check=True,
            )
            return res.stdout
        except subprocess.CalledProcessError as e:
            logger.warning(
                "system ffmpeg exited %d; falling through to PyAV", e.returncode
            )
            # fall through to PyAV

    # Tier 2: PyAV (libav bundled with the `av` wheel)
    try:
        return _transcode_with_pyav(input_bytes, target_sr)
    except Exception as e:
        logger.info("PyAV decode failed (%s); falling through to soundfile", e)

    # Tier 3: soundfile/libsndfile (only handles WAV/FLAC/OGG input)
    try:
        import librosa

        data, sr = sf.read(io.BytesIO(input_bytes), always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        data = data.astype(np.float32)
        if sr != target_sr:
            data = librosa.resample(data, orig_sr=sr, target_sr=target_sr)
        buf = io.BytesIO()
        sf.write(buf, data, target_sr, subtype="PCM_16", format="WAV")
        return buf.getvalue()
    except Exception as e:
        missing = []
        if not ffmpeg_available():
            missing.append("ffmpeg on PATH, or pip install av")
        try:
            import av as _av  # noqa: F401
        except ImportError:
            if "pip install av" not in " ".join(missing):
                missing.append("pip install av")
        try:
            import librosa as _lib  # noqa: F401
        except ImportError:
            missing.append("pip install librosa")
        hint = f" Install: {'; '.join(missing)}." if missing else ""
        raise FFmpegError(
            f"all transcode tiers failed (final soundfile error: {e!r}).{hint}"
        ) from e


def _transcode_with_pyav(input_bytes: bytes, target_sr: int) -> bytes:
    """Decode any libav-supported container (WebM/Opus, MP4/AAC, OGG, ...)
    -> mono float32 -> resample -> WAV bytes. Uses PyAV's audio resampler
    so it works without an external ffmpeg install.
    """
    import av

    in_buf = io.BytesIO(input_bytes)
    container = av.open(in_buf)
    try:
        stream = next(s for s in container.streams if s.type == "audio")
    except StopIteration:
        container.close()
        raise FFmpegError("input has no audio stream")

    resampler = av.AudioResampler(format="s16", layout="mono", rate=target_sr)
    chunks: list[np.ndarray] = []

    for frame in container.decode(stream):
        for resampled in resampler.resample(frame):
            arr = resampled.to_ndarray()
            # to_ndarray returns shape (channels, samples) for "s16" packed
            # planar — mono comes out as (1, N). Flatten to (N,).
            chunks.append(arr.reshape(-1))

    # Drain any buffered samples
    for resampled in resampler.resample(None):
        arr = resampled.to_ndarray()
        chunks.append(arr.reshape(-1))

    container.close()

    if not chunks:
        raise FFmpegError("PyAV produced no audio samples")

    pcm = np.concatenate(chunks).astype(np.int16)
    out = io.BytesIO()
    sf.write(out, pcm, target_sr, subtype="PCM_16", format="WAV")
    return out.getvalue()


def load_wav(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    """Decode WAV bytes -> (float32 mono array in [-1, 1], samplerate).

    Always returns float32 mono. If the input is multi-channel, channels are
    averaged. If the samplerate isn't TARGET_SR, the array is returned as-is
    with its native samplerate (caller decides whether to resample).
    """
    data, sr = sf.read(io.BytesIO(wav_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data.astype(np.float32), int(sr)


# ---------------------------------------------------------------------------
# 2. VAD + SNR
# ---------------------------------------------------------------------------


_silero_cache: dict[str, object] = {}


def _silero():
    """Lazy-load Silero VAD ONNX model (cached per process)."""
    if "model" not in _silero_cache:
        from silero_vad import load_silero_vad

        _silero_cache["model"] = load_silero_vad(onnx=True)
    return _silero_cache["model"]


def vad_segments(
    audio: np.ndarray,
    sr: int = TARGET_SR,
    min_speech_ms: int = 250,
) -> list[tuple[float, float]]:
    """Return [(start_s, end_s), ...] voiced segments via Silero VAD.

    Empty list when nothing is voiced. Silero requires the audio at 16 kHz
    or 8 kHz; if `sr` is something else we resample temporarily (no mutation
    of the caller's array).
    """
    if audio.size == 0:
        return []

    if sr != 16000 and sr != 8000:
        import librosa
        audio = librosa.resample(audio.astype(np.float32), orig_sr=sr, target_sr=16000)
        sr = 16000

    import torch
    from silero_vad import get_speech_timestamps

    model = _silero()
    audio_tensor = torch.from_numpy(audio.astype(np.float32))
    timestamps = get_speech_timestamps(
        audio_tensor, model,
        sampling_rate=sr,
        min_speech_duration_ms=min_speech_ms,
        return_seconds=True,
    )
    return [(float(t["start"]), float(t["end"])) for t in timestamps]


def compute_snr_db(
    audio: np.ndarray,
    sr: int = TARGET_SR,
    *,
    voiced: list[tuple[float, float]] | None = None,
) -> float:
    """Compute SNR in dB as 20*log10(rms_voiced / rms_silence).

    If `voiced` is None we run VAD ourselves. Returns 60.0 if there's no
    silence (ratio is unbounded). Returns -inf wrapper (-60.0) if voiced
    portion is empty.
    """
    if audio.size == 0:
        return -60.0
    voiced = voiced if voiced is not None else vad_segments(audio, sr)
    if not voiced:
        return -60.0

    mask = np.zeros(audio.size, dtype=bool)
    for start, end in voiced:
        s = max(0, int(start * sr))
        e = min(audio.size, int(end * sr))
        if e > s:
            mask[s:e] = True

    voiced_part = audio[mask]
    silence_part = audio[~mask]

    rms_v = math.sqrt(float(np.mean(voiced_part ** 2))) if voiced_part.size else 0.0
    rms_s = math.sqrt(float(np.mean(silence_part ** 2))) if silence_part.size else 0.0

    if rms_v <= 1e-9:
        return -60.0
    if rms_s <= 1e-9:
        return 60.0
    snr = 20.0 * math.log10(rms_v / rms_s)
    return float(np.clip(snr, -60.0, 60.0))


# ---------------------------------------------------------------------------
# 3. stage splitter
# ---------------------------------------------------------------------------


def split_stages(
    audio: np.ndarray,
    sr: int,
    offsets: Mapping[str, tuple[float, float] | list[float]],
) -> dict[str, np.ndarray]:
    """Carve a long audio array into per-stage sub-arrays.

    Raises:
      - MissingStageError if any of the 4 required stages is absent.
      - InvalidStageOffsetError on negative / decreasing / out-of-bounds ranges.
    """
    duration_s = audio.size / sr

    for name in REQUIRED_STAGES:
        if name not in offsets:
            raise MissingStageError(f"missing stage: {name!r}")

    out: dict[str, np.ndarray] = {}
    for name, rng in offsets.items():
        if name not in REQUIRED_STAGES:
            continue  # ignore unknown stages quietly
        try:
            start, end = float(rng[0]), float(rng[1])
        except (TypeError, IndexError) as e:
            raise InvalidStageOffsetError(
                f"stage {name!r} has malformed range: {rng!r}"
            ) from e
        if start < 0 or end <= start:
            raise InvalidStageOffsetError(
                f"stage {name!r} has invalid range [{start}, {end}]"
            )
        # Allow up to ~0.5s past end-of-array to absorb rounding; clamp.
        if start > duration_s + 0.5:
            raise InvalidStageOffsetError(
                f"stage {name!r} starts at {start}s but audio is only {duration_s:.2f}s"
            )
        s = max(0, int(round(start * sr)))
        e = min(audio.size, int(round(end * sr)))
        out[name] = audio[s:e]
    return out
