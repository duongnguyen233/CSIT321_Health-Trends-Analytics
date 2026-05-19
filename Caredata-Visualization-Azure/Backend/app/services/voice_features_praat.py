"""Praat-derived features via parselmouth (jitter / shimmer / HNR / CPP / MPT).

Computed exclusively on the `sustained_a` stage:

- jitter_local       : period-to-period frequency perturbation
- jitter_rap         : 3-period relative average perturbation
- jitter_ppq5        : 5-period perturbation quotient
- shimmer_local      : period-to-period amplitude perturbation
- shimmer_apq3       : 3-period amplitude perturbation quotient
- shimmer_apq5       : 5-period amplitude perturbation quotient
- hnr_mean           : harmonics-to-noise ratio (dB), mean over voiced frames
- cpp                : cepstral peak prominence (dB)
- mpt                : maximum phonation time (longest voiced segment, seconds)

Praat is fragile on near-silent / aperiodic input: any internal exception
returns a sentinel all-NaN dict with `_failed=True` so the rest of the
pipeline keeps moving (per VOICE_BIOMARKER.md pitfall #4).
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np


logger = logging.getLogger(__name__)


KEYS: tuple[str, ...] = (
    "jitter_local",
    "jitter_rap",
    "jitter_ppq5",
    "shimmer_local",
    "shimmer_apq3",
    "shimmer_apq5",
    "hnr_mean",
    "cpp",
    "mpt",
)


def _nan_dict(failed: bool) -> dict[str, Any]:
    out: dict[str, Any] = {k: 0.0 for k in KEYS}
    out["_failed"] = failed
    out["_nan_count"] = len(KEYS) if failed else 0
    return out


def extract_praat(audio: np.ndarray, sr: int = 16000) -> dict[str, Any]:
    """Extract Praat acoustics from a sustained-vowel float32 array."""
    if audio.size == 0 or sr <= 0:
        return _nan_dict(failed=True)

    try:
        import parselmouth
        from parselmouth.praat import call

        snd = parselmouth.Sound(audio.astype(np.float32), sampling_frequency=sr)

        # Pitch + PointProcess (used for jitter / shimmer)
        pitch = snd.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
        point_process = call(
            [snd, pitch], "To PointProcess (cc)"
        )

        def _safe(fn, *args, default=0.0) -> float:
            try:
                v = float(fn(*args))
                if not np.isfinite(v):
                    return default
                return v
            except Exception:
                return default

        # Jitter (PointProcess based; standard Praat 75-600 Hz, 1.3 thresh)
        jitter_local = _safe(
            call, point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3
        )
        jitter_rap = _safe(
            call, point_process, "Get jitter (rap)", 0, 0, 0.0001, 0.02, 1.3
        )
        jitter_ppq5 = _safe(
            call, point_process, "Get jitter (ppq5)", 0, 0, 0.0001, 0.02, 1.3
        )

        # Shimmer (sound + point process)
        shimmer_local = _safe(
            call, [snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
        )
        shimmer_apq3 = _safe(
            call, [snd, point_process], "Get shimmer (apq3)", 0, 0, 0.0001, 0.02, 1.3, 1.6
        )
        shimmer_apq5 = _safe(
            call, [snd, point_process], "Get shimmer (apq5)", 0, 0, 0.0001, 0.02, 1.3, 1.6
        )

        # HNR
        try:
            harmonicity = snd.to_harmonicity_cc(time_step=0.01)
            hnr_mean = _safe(call, harmonicity, "Get mean", 0, 0)
        except Exception:
            hnr_mean = 0.0

        # CPP — Praat exposes "Cepstral peak prominence (smoothed)" via
        # PowerCepstrogram.
        try:
            spec = snd.to_spectrogram(window_length=0.04, maximum_frequency=8000)
            powerc = call(spec, "To PowerCepstrogram")
            cpp = _safe(call, powerc, "Get CPPS", "no", 0.01, 0.001, 60, 330, 0.05,
                        "Parabolic", 0.001, 0, "Exponential decay", "Robust slow")
        except Exception:
            cpp = 0.0

        # MPT — longest voiced run from pitch frames (frame -> 0.01 s)
        try:
            voiced_mask = np.array(
                [pitch.get_value_at_time(t) is not None and not np.isnan(
                    pitch.get_value_at_time(t)
                ) for t in pitch.xs()]
            )
            if voiced_mask.size == 0:
                mpt = 0.0
            else:
                # Run-length-encode True regions, return longest run in seconds
                longest = 0
                cur = 0
                for v in voiced_mask:
                    if v:
                        cur += 1
                        longest = max(longest, cur)
                    else:
                        cur = 0
                # Pitch time step is 0.01s by construction above
                mpt = float(longest) * 0.01
        except Exception:
            mpt = 0.0

        return {
            "jitter_local": jitter_local,
            "jitter_rap": jitter_rap,
            "jitter_ppq5": jitter_ppq5,
            "shimmer_local": shimmer_local,
            "shimmer_apq3": shimmer_apq3,
            "shimmer_apq5": shimmer_apq5,
            "hnr_mean": hnr_mean,
            "cpp": cpp,
            "mpt": mpt,
            "_failed": False,
            "_nan_count": 0,
        }
    except Exception as e:
        logger.warning("Praat extraction failed: %s", e)
        return _nan_dict(failed=True)
