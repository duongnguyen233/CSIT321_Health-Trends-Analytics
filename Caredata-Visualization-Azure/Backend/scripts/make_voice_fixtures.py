"""Generate synthetic test fixtures for the voice biomarker pipeline.

These are NOT real recordings — they are deterministic synthetic signals
crafted to give each feature extractor something plausible to chew on:

- silence_5s.wav     : near-silence (small gaussian floor) for VAD/SNR negative
- clean_voice_10s.wav: amplitude-modulated harmonic tone with breath gaps,
                       so VAD picks out voiced segments and SNR is high
- sustained_a_5s.wav : steady glottal-pulse-like waveform (200 Hz fundamental
                       + harmonics) — Praat should compute finite jitter,
                       shimmer, HNR, CPP, MPT
- pataka_5s.wav      : amplitude-modulated noise bursts at ~5 Hz mimicking
                       /pa-ta-ka/ syllables for the DDK rate test
- noisy_5s.wav       : pure white noise — SNR should be < 6 dB (low_snr branch)

Run once to (re)generate fixtures:

    python scripts/make_voice_fixtures.py

Fixtures live under `tests/voice/fixtures/` and are committed.
"""
from __future__ import annotations
import math
from pathlib import Path

import numpy as np
import soundfile as sf


SR = 16000
RNG = np.random.default_rng(20260505)


def _save(path: Path, audio: np.ndarray) -> None:
    audio = np.clip(audio, -1.0, 1.0).astype(np.float32)
    sf.write(path, audio, SR, subtype="PCM_16")


def silence(seconds: float = 5.0) -> np.ndarray:
    n = int(seconds * SR)
    return 1e-4 * RNG.standard_normal(n)


def clean_voice(seconds: float = 10.0) -> np.ndarray:
    """Voice-like signal with breath gaps for VAD positive."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    # Fundamental + harmonics (vocal-fold-ish)
    f0 = 180.0
    sig = (
        0.35 * np.sin(2 * np.pi * f0 * t)
        + 0.20 * np.sin(2 * np.pi * 2 * f0 * t)
        + 0.10 * np.sin(2 * np.pi * 3 * f0 * t)
    )
    # Slow envelope (~3 Hz) to create syllable rhythm
    env = 0.5 + 0.5 * np.sin(2 * np.pi * 3.0 * t)
    sig = sig * env
    # Insert two clean pause gaps (silence) so VAD has something to find
    pause_starts = [int(2.0 * SR), int(6.0 * SR)]
    pause_dur = int(0.5 * SR)
    for s in pause_starts:
        sig[s:s + pause_dur] *= 0.01
    # Tiny noise floor so SNR isn't infinite
    sig += 1e-3 * RNG.standard_normal(n)
    return sig


def sustained_a(seconds: float = 5.0) -> np.ndarray:
    """Steady glottal-pulse-like waveform with mild jitter/shimmer."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    f0 = 200.0
    # Add small period jitter (~0.5%) so Praat's jitter metric is finite
    jitter = 1.0 + 0.005 * RNG.standard_normal(n)
    phase = np.cumsum(2 * np.pi * f0 * jitter / SR)
    sig = (
        0.5 * np.sin(phase)
        + 0.25 * np.sin(2 * phase)
        + 0.12 * np.sin(3 * phase)
        + 0.06 * np.sin(4 * phase)
    )
    # Mild amplitude modulation for shimmer
    am = 1.0 + 0.02 * np.sin(2 * np.pi * 3 * t) + 0.005 * RNG.standard_normal(n)
    sig = sig * am
    sig += 1e-3 * RNG.standard_normal(n)
    return sig


def pataka(seconds: float = 5.0, rate_hz: float = 5.0) -> np.ndarray:
    """Amplitude-modulated noise bursts ~rate_hz/sec to mimic /pa-ta-ka/."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    # Sharp on-off envelope at rate_hz
    burst_period = 1.0 / rate_hz
    burst_dur = burst_period * 0.35  # ~35% duty cycle
    env = np.zeros(n)
    burst = 0
    while burst * burst_period < seconds:
        s = int(burst * burst_period * SR)
        e = int((burst * burst_period + burst_dur) * SR)
        env[s:min(e, n)] = 1.0
        burst += 1
    # Smooth edges
    smooth_n = int(0.02 * SR)
    if smooth_n > 1:
        kernel = np.ones(smooth_n) / smooth_n
        env = np.convolve(env, kernel, mode="same")
    # Carrier: filtered noise so onsets are sharp (energy peaks)
    noise = RNG.standard_normal(n)
    sig = 0.5 * noise * env
    sig += 1e-3 * RNG.standard_normal(n)
    return sig


def noisy(seconds: float = 5.0) -> np.ndarray:
    """Pure white noise — should produce SNR < 6 dB."""
    n = int(seconds * SR)
    return 0.4 * RNG.standard_normal(n)


FIXTURES = {
    "silence_5s.wav": silence,
    "clean_voice_10s.wav": clean_voice,
    "sustained_a_5s.wav": sustained_a,
    "pataka_5s.wav": pataka,
    "noisy_5s.wav": noisy,
}


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "tests" / "voice" / "fixtures"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, gen in FIXTURES.items():
        audio = gen()
        path = out_dir / name
        _save(path, audio)
        print(f"wrote {path} ({len(audio) / SR:.1f}s, {audio.dtype})")


if __name__ == "__main__":
    main()
