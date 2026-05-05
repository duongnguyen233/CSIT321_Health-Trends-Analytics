"""Voice biomarker v2 demo seed.

Replaces the legacy voice_seed.py. Creates 4 demo residents with synthetic
recordings + scores in the v2 vocabulary:

- Residents R-V001..R-V003: 14 baseline-style recordings each, near-zero
  concern scores (well within their per-resident baseline once Phase 3
  fits the model).
- Resident R-V004: 14 baseline recordings PLUS 3 progressively drifted
  recordings on the phonatory + prosodic dimensions — material for the
  Phase 3 alert demo.

Idempotent: skips seeding if R-V001 already has a voice profile.

This is synthetic data — feature dicts are sampled deterministically per
recording, not produced by a real audio pipeline. Phase 3 will use the
shape of these features to fit the per-resident baselines.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from app.core.security import hash_password
from app.services import (
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
)


logger = logging.getLogger(__name__)


# Reasonable per-resident "centroid" feature vectors. Phonatory & prosodic
# values are derived columns we'll use during scoring. The synthetic data
# does NOT include real audio; voice_recording_db.audio_blob_uri is set to
# memory:// URIs that won't resolve, but Phase 3 does not need to read the
# audio back to score, only the persisted feature dict.
DEMO_RESIDENTS = [
    {
        "resident_id": "R-V001",
        "display_name": "Margaret (demo)",
        "password": "voicedemo",
        "centroid": {"phonatory": 0.0, "articulatory": 0.0, "prosodic": 0.0,
                     "respiratory": 0.0, "linguistic": 0.0},
        "drift": False,
    },
    {
        "resident_id": "R-V002",
        "display_name": "Harold (demo)",
        "password": "voicedemo",
        "centroid": {"phonatory": 0.2, "articulatory": -0.1, "prosodic": 0.05,
                     "respiratory": -0.2, "linguistic": 0.1},
        "drift": False,
    },
    {
        "resident_id": "R-V003",
        "display_name": "Elizabeth (demo)",
        "password": "voicedemo",
        "centroid": {"phonatory": -0.15, "articulatory": 0.2, "prosodic": -0.1,
                     "respiratory": 0.05, "linguistic": -0.05},
        "drift": False,
    },
    {
        "resident_id": "R-V004",
        "display_name": "Dorothy (demo, drift)",
        "password": "voicedemo",
        "centroid": {"phonatory": 0.1, "articulatory": 0.1, "prosodic": 0.0,
                     "respiratory": 0.0, "linguistic": 0.05},
        "drift": True,
    },
]


def _synthetic_features(centroid: dict[str, float], rng: random.Random,
                        drift_strength: float = 0.0) -> dict:
    """Return a placeholder per-recording feature dict with small jitter.

    drift_strength multiplies an extra phonatory + prosodic shift; 0.0 means
    in-baseline, 1.0 means a pronounced drift used for the demo resident.
    """
    return {
        "phonatory_z": centroid["phonatory"] + rng.gauss(0, 0.3) + 3.0 * drift_strength,
        "articulatory_z": centroid["articulatory"] + rng.gauss(0, 0.3),
        "prosodic_z": centroid["prosodic"] + rng.gauss(0, 0.3) + 2.0 * drift_strength,
        "respiratory_z": centroid["respiratory"] + rng.gauss(0, 0.3),
        "linguistic_z": centroid["linguistic"] + rng.gauss(0, 0.3),
        "duration_s": rng.uniform(70, 80),
        "snr_db": rng.uniform(15, 25),
    }


def seed_v2_demo_data() -> None:
    """Populate storage with the 4 v2 demo residents if none exist yet."""
    if voice_profile_db.get_by_resident_id("R-V001"):
        logger.info("Voice v2 seed: demo residents already exist, skipping.")
        return
    logger.info("Seeding 4 v2 demo voice residents...")

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

        # 14 baseline recordings, oldest first
        baseline_count = 14
        for i in range(baseline_count):
            day = today - timedelta(days=baseline_count - i)
            rec_id = str(uuid.uuid4())
            features = _synthetic_features(demo["centroid"], rng, drift_strength=0.0)
            voice_recording_db.create_recording(
                profile_id=profile_id,
                recording_id=rec_id,
                duration_s=features["duration_s"],
                prompt_id="v1",
                audio_blob_uri=f"memory://{demo['resident_id']}/{rec_id}.webm",
                stage_offsets={
                    "sustained_a": [0.0, 6.0],
                    "ddk": [6.0, 11.0],
                    "reading": [11.0, 18.0],
                    "open_prompt": [18.0, features["duration_s"]],
                },
                context_flags={"cold": False, "dentures_out": False,
                               "just_woke_up": False, "pain": False},
                client_meta={"sample_rate": 48000, "channels": 1,
                             "echo_cancellation": True,
                             "noise_suppression": False,
                             "auto_gain_control": False,
                             "ua": "demo-seed/1.0"},
                snr_db=features["snr_db"],
            )
            voice_recording_db.update_status(profile_id, rec_id, "done")
            voice_score_db.create_score(
                profile_id=profile_id,
                recording_id=rec_id,
                concern_score=0.0,  # Phase 3 will replace with real scoring
                subscores={
                    "phonatory": abs(features["phonatory_z"]) * 10,
                    "articulatory": abs(features["articulatory_z"]) * 10,
                    "prosodic": abs(features["prosodic_z"]) * 10,
                    "respiratory": abs(features["respiratory_z"]) * 10,
                    "linguistic": abs(features["linguistic_z"]) * 10,
                },
            )

        # Drift recordings for R-V004
        if demo["drift"]:
            for i in range(3):
                day = today - timedelta(days=2 - i)
                rec_id = str(uuid.uuid4())
                features = _synthetic_features(
                    demo["centroid"], rng, drift_strength=0.4 + 0.3 * i,
                )
                voice_recording_db.create_recording(
                    profile_id=profile_id,
                    recording_id=rec_id,
                    duration_s=features["duration_s"],
                    prompt_id="v1",
                    audio_blob_uri=f"memory://{demo['resident_id']}/{rec_id}.webm",
                    stage_offsets={
                        "sustained_a": [0.0, 6.0],
                        "ddk": [6.0, 11.0],
                        "reading": [11.0, 18.0],
                        "open_prompt": [18.0, features["duration_s"]],
                    },
                    context_flags={"cold": False, "dentures_out": False,
                                   "just_woke_up": False, "pain": False},
                    client_meta={"sample_rate": 48000, "channels": 1,
                                 "echo_cancellation": True,
                                 "noise_suppression": False,
                                 "auto_gain_control": False,
                                 "ua": "demo-seed/1.0"},
                    snr_db=features["snr_db"],
                )
                voice_recording_db.update_status(profile_id, rec_id, "done")
                voice_score_db.create_score(
                    profile_id=profile_id,
                    recording_id=rec_id,
                    concern_score=40.0 + 20.0 * i,  # placeholder ramp
                    subscores={
                        "phonatory": min(100.0, 50.0 + 15.0 * i),
                        "articulatory": 10.0,
                        "prosodic": min(100.0, 40.0 + 15.0 * i),
                        "respiratory": 10.0,
                        "linguistic": 10.0,
                    },
                )

        # Profile bookkeeping
        recording_count = baseline_count + (3 if demo["drift"] else 0)
        voice_profile_db.update_profile(profile_id, {
            "last_recording_date": datetime.now(timezone.utc).isoformat(),
            "baseline_recording_count": recording_count,
            "baseline_established": recording_count >= 10,
        })

        # One open link per resident for nurses to issue manually if desired
        now = datetime.now(timezone.utc)
        voice_link_db.create_link(
            resident_id=demo["resident_id"],
            facility_id="default",
            generated_by="demo-nurse",
            expires_at=(now + timedelta(days=2)).isoformat(),
            valid_for_date=today.isoformat(),
        )

    logger.info("Voice v2 seed complete.")
