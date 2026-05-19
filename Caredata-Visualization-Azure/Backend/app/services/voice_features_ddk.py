"""DDK (diadochokinetic) rate from the /pa-ta-ka/ stage.

Two metrics:
- ddk_rate_per_s : syllables per second from energy-onset detection
- ddk_isi_cv     : coefficient of variation of inter-syllable intervals
                   (std / mean). Lower = more regular cadence.

Detection uses librosa's onset_detect on the local energy envelope. Robust
to noisy synthetic fixtures because we don't try to distinguish /pa/ vs
/ta/ vs /ka/ — only that something energetic happened.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np


logger = logging.getLogger(__name__)


def extract_ddk(audio: np.ndarray, sr: int = 16000) -> dict[str, Any]:
    """Return {ddk_rate_per_s, ddk_isi_cv, _n_onsets, _failed}.

    Empty / near-silent input returns {0.0, 0.0, 0, True}.
    """
    if audio.size == 0:
        return {"ddk_rate_per_s": 0.0, "ddk_isi_cv": 0.0, "_n_onsets": 0, "_failed": True}

    duration_s = audio.size / sr
    if duration_s < 0.5:
        return {"ddk_rate_per_s": 0.0, "ddk_isi_cv": 0.0, "_n_onsets": 0, "_failed": True}

    try:
        import librosa

        # Energy gate: if the whole clip is essentially silent (peak RMS
        # below threshold), don't try to detect onsets — it just amplifies
        # noise into spurious "syllables".
        peak_amp = float(np.max(np.abs(audio)))
        if peak_amp < 0.01:
            return {
                "ddk_rate_per_s": 0.0,
                "ddk_isi_cv": 0.0,
                "_n_onsets": 0,
                "_failed": False,
            }

        onset_frames = librosa.onset.onset_detect(
            y=audio.astype(np.float32),
            sr=sr,
            units="time",
            backtrack=False,
            hop_length=256,
            pre_max=2,
            post_max=2,
            pre_avg=4,
            post_avg=4,
            delta=0.05,
            wait=2,
        )
        onsets = np.asarray(onset_frames, dtype=np.float32)

        n_onsets = int(onsets.size)
        if n_onsets < 2:
            return {
                "ddk_rate_per_s": float(n_onsets) / duration_s,
                "ddk_isi_cv": 0.0,
                "_n_onsets": n_onsets,
                "_failed": False,
            }

        rate = n_onsets / duration_s

        isis = np.diff(onsets)
        if isis.size == 0 or np.mean(isis) <= 1e-6:
            isi_cv = 0.0
        else:
            isi_cv = float(np.std(isis) / np.mean(isis))
            if not np.isfinite(isi_cv):
                isi_cv = 0.0

        return {
            "ddk_rate_per_s": float(rate),
            "ddk_isi_cv": float(isi_cv),
            "_n_onsets": n_onsets,
            "_failed": False,
        }
    except Exception as e:
        logger.warning("DDK extraction failed: %s", e)
        return {"ddk_rate_per_s": 0.0, "ddk_isi_cv": 0.0, "_n_onsets": 0, "_failed": True}
