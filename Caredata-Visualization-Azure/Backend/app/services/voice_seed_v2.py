"""Voice biomarker v2 demo seed.

Creates 4 demo residents with synthetic recordings, persisted features,
scores, and (for R-V004) a deliberate drift profile that triggers a
review alert via the Phase 3 alert engine.

Layout (deterministic, seeded RNG):

  R-V001 Margaret    : 20 baseline recordings + scores (concern ~ 0)
  R-V002 Harold      : 20 baseline recordings + scores (concern ~ 0)
  R-V003 Elizabeth   : 20 baseline recordings + scores (concern ~ 0)
  R-V004 Dorothy     : 20 baseline recordings + 5 progressively drifted
                       recordings on the phonatory + prosodic dimensions
                       -> evaluate_alerts() emits a review alert.

Idempotent: skips seeding if R-V001 already has a voice profile.

This is synthetic data — feature dicts are sampled deterministically per
recording (NOT produced by a real audio pipeline) so Phase 3 lock-baseline
+ scoring exercises the full code path on demo data.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from app.core.security import hash_password
from app.services import (
    voice_alerts,
    voice_analysis_db,
    voice_features_db,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
)
from app.services.voice_score_vector import (
    DDK_KEYS,
    EGEMAPS_ALL,
    LINGUISTIC_KEYS,
    PRAAT_KEYS,
)


logger = logging.getLogger(__name__)


BASELINE_COUNT = 20
DRIFT_COUNT = 5

DEMO_RESIDENTS = [
    {
        "resident_id": "R-V001",
        "display_name": "Margaret (demo)",
        "password": "voicedemo",
        "drift": False,
    },
    {
        "resident_id": "R-V002",
        "display_name": "Harold (demo)",
        "password": "voicedemo",
        "drift": False,
    },
    {
        "resident_id": "R-V003",
        "display_name": "Elizabeth (demo)",
        "password": "voicedemo",
        "drift": False,
    },
    {
        "resident_id": "R-V004",
        "display_name": "Dorothy (demo, drift)",
        "password": "voicedemo",
        "drift": True,
    },
]


def _synth_features(rng: random.Random, drift_strength: float = 0.0) -> dict:
    """Build a feature dict with the same shape voice_processor_v2 produces.

    drift_strength shifts phonatory + prosodic features off-distribution to
    simulate the resident drift demo.
    """
    drift = drift_strength

    egemaps = {name: rng.gauss(0, 1) for name in EGEMAPS_ALL}
    # Lift phonatory eGeMAPS keys when drifting
    for k in egemaps:
        if "F0" in k or "jitter" in k.lower() or "shimmer" in k.lower() or "HNR" in k:
            egemaps[k] += drift * 4.0

    return {
        "egemaps_sustained_a": egemaps,
        "egemaps_reading": {name: rng.gauss(0, 1) for name in EGEMAPS_ALL},
        "egemaps_open_prompt": {name: rng.gauss(0, 1) for name in EGEMAPS_ALL},
        "praat": {
            "jitter_local": 0.012 + drift * 0.020 + rng.gauss(0, 0.001),
            "jitter_rap": 0.005 + drift * 0.010 + rng.gauss(0, 0.0005),
            "jitter_ppq5": 0.006 + drift * 0.012 + rng.gauss(0, 0.0005),
            "shimmer_local": 0.04 + drift * 0.05 + rng.gauss(0, 0.002),
            "shimmer_apq3": 0.02 + drift * 0.03 + rng.gauss(0, 0.001),
            "shimmer_apq5": 0.025 + drift * 0.035 + rng.gauss(0, 0.0015),
            "hnr_mean": 20.0 - drift * 8.0 + rng.gauss(0, 1.0),
            "cpp": 15.0 - drift * 4.0 + rng.gauss(0, 1.0),
            "mpt": 5.0 - drift * 2.0 + rng.gauss(0, 0.3),
        },
        "linguistic": {
            "speech_rate_wpm": 120 + rng.gauss(0, 10),
            "articulation_rate_wpm": 140 + rng.gauss(0, 10),
            "pause_ratio": 0.15 + drift * 0.10 + rng.gauss(0, 0.02),
            "n_pauses": rng.randint(3, 8) + int(drift * 3),
            "mean_pause_s": 0.5 + drift * 0.3 + rng.gauss(0, 0.05),
            "n_filled_pauses": rng.randint(0, 3),
            "ttr": 0.7 + rng.gauss(0, 0.05),
            "idea_density": 0.5 + rng.gauss(0, 0.05),
            "n_words": rng.randint(40, 80),
        },
        "ddk": {
            "ddk_rate_per_s": 5.0 + rng.gauss(0, 0.3),
            "ddk_isi_cv": 0.1 + drift * 0.1 + rng.gauss(0, 0.02),
        },
        "transcript": "demo recording",
        "snr_db": rng.uniform(15, 25),
        "voiced_duration_s": rng.uniform(50, 60),
        "duration_s": rng.uniform(70, 80),
    }


def _create_demo_recording(
    profile_id: str,
    resident_id: str,
    rec_id: str,
    when: datetime,
    rng: random.Random,
    drift_strength: float = 0.0,
) -> dict:
    """Persist one synthetic recording end-to-end (recording + features +
    placeholder/baselined score). Returns the features dict so the caller
    can score it later if they want to drive the alert engine."""
    features = _synth_features(rng, drift_strength)
    voice_recording_db.create_recording(
        profile_id=profile_id,
        recording_id=rec_id,
        duration_s=features["duration_s"],
        prompt_id="v1",
        audio_blob_uri=f"memory://{resident_id}/{rec_id}.webm",
        stage_offsets={
            "sustained_a": [0.0, 6.0],
            "ddk": [6.0, 11.0],
            "reading": [11.0, 18.0],
            "open_prompt": [18.0, features["duration_s"]],
        },
        context_flags={"cold": False, "dentures_out": False,
                       "just_woke_up": False, "pain": False},
        client_meta={"sample_rate": 48000, "channels": 1,
                     "echo_cancellation": True, "noise_suppression": False,
                     "auto_gain_control": False, "ua": "demo-seed/1.0"},
        snr_db=features["snr_db"],
    )
    voice_recording_db.update_status(profile_id, rec_id, "done")
    voice_features_db.create_features(
        profile_id=profile_id,
        recording_id=rec_id,
        features=features,
    )
    return features


def seed_v2_demo_data() -> None:
    """Populate storage with the 4 v2 demo residents if none exist yet."""
    if voice_profile_db.get_by_resident_id("R-V001"):
        logger.info("Voice v2 seed: demo residents already exist, skipping.")
        return
    logger.info(
        "Seeding 4 v2 demo voice residents (%d baseline + %d drift on R-V004)...",
        BASELINE_COUNT, DRIFT_COUNT,
    )

    rng = random.Random(20260505)
    today = date.today()

    for demo in DEMO_RESIDENTS:
        profile = voice_profile_db.create_profile(
            resident_id=demo["resident_id"],
            facility_id="default",
            display_name=demo["display_name"],
            password_hash=hash_password(demo["password"]),
        )
        profile_id = profile["profile_id"]

        # Baseline recordings — oldest first so list_features ordering is correct
        for i in range(BASELINE_COUNT):
            when = datetime.combine(
                today - timedelta(days=BASELINE_COUNT + (DRIFT_COUNT if demo["drift"] else 0) - i),
                datetime.min.time(),
            ).replace(tzinfo=timezone.utc)
            rec_id = str(uuid.uuid4())
            _create_demo_recording(profile_id, demo["resident_id"], rec_id, when, rng, 0.0)
            voice_score_db.create_score(
                profile_id=profile_id,
                recording_id=rec_id,
                concern_score=0.0,
                subscores={
                    "phonatory": rng.uniform(0, 30),
                    "articulatory": rng.uniform(0, 30),
                    "prosodic": rng.uniform(0, 30),
                    "respiratory": rng.uniform(0, 30),
                    "linguistic": rng.uniform(0, 30),
                },
            )

        if not demo["drift"]:
            voice_profile_db.update_profile(profile_id, {
                "last_recording_date": datetime.now(timezone.utc).isoformat(),
                "baseline_recording_count": BASELINE_COUNT,
                "baseline_established": True,
            })
            voice_link_db.create_link(
                resident_id=demo["resident_id"], facility_id="default",
                generated_by="demo-nurse",
                expires_at=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                valid_for_date=today.isoformat(),
            )
            continue

        # ---- Drift profile (R-V004) -------------------------------------------
        drift_score_history: list[dict] = []
        for i in range(DRIFT_COUNT):
            when = datetime.combine(
                today - timedelta(days=DRIFT_COUNT - 1 - i),
                datetime.min.time(),
            ).replace(tzinfo=timezone.utc)
            rec_id = str(uuid.uuid4())
            strength = 0.5 + 0.1 * i  # 0.5 .. 0.9
            _create_demo_recording(
                profile_id, demo["resident_id"], rec_id, when, rng, strength,
            )

            # Synthesise high concern + sub-scores so the alert engine fires.
            phon = min(100.0, 70.0 + 6.0 * i)
            pros = min(100.0, 65.0 + 7.0 * i)
            concern = min(100.0, 78.0 + 5.0 * i)
            score_row = {
                "concern_score": concern,
                "recording_id": rec_id,
                "subscores": {
                    "phonatory": phon,
                    "articulatory": rng.uniform(10, 30),
                    "prosodic": pros,
                    "respiratory": rng.uniform(0, 20),
                    "linguistic": rng.uniform(10, 35),
                },
            }
            voice_score_db.create_score(
                profile_id=profile_id,
                recording_id=rec_id,
                concern_score=concern,
                subscores=score_row["subscores"],
            )
            drift_score_history.append(score_row)

        # Run the alert engine on the latest drift recording — uses the
        # earlier drift recordings as history. This produces real review
        # alerts visible immediately on the seeded dashboard.
        if len(drift_score_history) >= 2:
            history = list(reversed(drift_score_history[:-1]))[:3]
            today_score = drift_score_history[-1]
            candidates = voice_alerts.evaluate_alerts(
                today_score=today_score,
                history=history,
                today_context_flags={},
                history_context_flags=[{}] * len(history),
            )
            for c in candidates:
                if c.suppressed:
                    continue
                voice_analysis_db.create_dim_alert(
                    profile_id=profile_id,
                    resident_id=demo["resident_id"],
                    recording_id=today_score["recording_id"],
                    severity=c.severity,
                    dimension=c.dimension,
                    summary=c.summary,
                )

        voice_profile_db.update_profile(profile_id, {
            "last_recording_date": datetime.now(timezone.utc).isoformat(),
            "baseline_recording_count": BASELINE_COUNT + DRIFT_COUNT,
            "baseline_established": True,
        })
        voice_link_db.create_link(
            resident_id=demo["resident_id"], facility_id="default",
            generated_by="demo-nurse",
            expires_at=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            valid_for_date=today.isoformat(),
        )

    logger.info("Voice v2 seed complete.")
