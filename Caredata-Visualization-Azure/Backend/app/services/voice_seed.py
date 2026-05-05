"""
Seed 3 demo residents with realistic voice biomarker data on startup.
Called from main.py — only seeds if in-memory storage is empty.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.services import voice_analysis_db, voice_link_db, voice_profile_db

logger = logging.getLogger(__name__)

# ── Demo residents ──────────────────────────────────────────────────────────

DEMO_RESIDENTS = [
    {
        "resident_id": "R001",
        "display_name": "Margaret Chen",
        "facility_id": "default",
        "password": "1234",
        "analyses": [
            {
                "days_ago": 28,
                "features": {
                    "duration_s": 42.5,
                    "speech_duration_s": 34.2,
                    "pause_duration_s": 8.3,
                    "pause_count": 4,
                    "mean_pause_duration_s": 2.075,
                    "speech_rate_proxy": 3.42,
                    "mean_energy": 1820.5,
                    "energy_std": 410.3,
                    "vocal_fatigue_index": 0.92,
                    "pitch_mean_hz": 198.4,
                    "pitch_std_hz": 14.2,
                    "jitter_pct": 1.12,
                    "shimmer_pct": 2.84,
                    "zcr_mean": 1240.6,
                    "spectral_centroid_hz": 1680.3,
                },
                "risk_scores": {},
                "alert_level": "green",
                "confidence": "low",
                "transcript": "One, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
                "narrative": (
                    "Recording duration: 42.5s. Speech occupied 80.5% of the recording. "
                    "4 pause(s) detected with mean duration 2.08s. Mean pitch: 198 Hz. "
                    "This is the baseline recording. Future recordings will be compared against these values. "
                    "Margaret demonstrated clear articulation and steady pacing throughout the counting task. "
                    "No signs of vocal fatigue, speech hesitation, or abnormal prosody were detected."
                ),
            },
            {
                "days_ago": 21,
                "features": {
                    "duration_s": 55.8,
                    "speech_duration_s": 43.1,
                    "pause_duration_s": 12.7,
                    "pause_count": 6,
                    "mean_pause_duration_s": 2.117,
                    "speech_rate_proxy": 3.38,
                    "mean_energy": 1790.2,
                    "energy_std": 395.7,
                    "vocal_fatigue_index": 0.89,
                    "pitch_mean_hz": 195.1,
                    "pitch_std_hz": 15.8,
                    "jitter_pct": 1.24,
                    "shimmer_pct": 3.01,
                    "zcr_mean": 1215.4,
                    "spectral_centroid_hz": 1654.8,
                },
                "risk_scores": {
                    "speech_rate_change_pct": -1.2,
                    "pause_duration_change_pct": 2.0,
                    "energy_change_pct": -1.7,
                    "pitch_change_pct": -1.7,
                    "jitter_change_pct": 10.7,
                    "shimmer_change_pct": 6.0,
                    "overall_deviation_pct": 2.0,
                    "alert_level": "green",
                },
                "alert_level": "green",
                "confidence": "medium",
                "transcript": "My favourite meal would have to be my daughter's roast lamb. She makes it every Sunday when I visit. The potatoes are always crispy, and she does this mint sauce from scratch. My late husband used to say it was better than his mother's, which was quite the compliment.",
                "narrative": (
                    "Recording duration: 55.8s. Speech occupied 77.2% of the recording. "
                    "6 pause(s) detected with mean duration 2.12s. Mean pitch: 195 Hz. "
                    "Compared to baseline: speech rate changed by -1.2%, pause duration changed by +2.0%. "
                    "Voice biomarkers are within normal range of baseline. Margaret's open-response speech was fluent "
                    "and well-organised, with appropriate pausing for natural phrasing. Vocabulary recall and narrative "
                    "coherence were strong. No indicators of concern."
                ),
            },
            {
                "days_ago": 14,
                "features": {
                    "duration_s": 48.3,
                    "speech_duration_s": 38.9,
                    "pause_duration_s": 9.4,
                    "pause_count": 5,
                    "mean_pause_duration_s": 1.88,
                    "speech_rate_proxy": 3.51,
                    "mean_energy": 1835.1,
                    "energy_std": 420.8,
                    "vocal_fatigue_index": 0.94,
                    "pitch_mean_hz": 200.2,
                    "pitch_std_hz": 13.5,
                    "jitter_pct": 1.08,
                    "shimmer_pct": 2.72,
                    "zcr_mean": 1255.2,
                    "spectral_centroid_hz": 1695.1,
                },
                "risk_scores": {
                    "speech_rate_change_pct": 2.6,
                    "pause_duration_change_pct": -9.4,
                    "energy_change_pct": 0.8,
                    "pitch_change_pct": 0.9,
                    "jitter_change_pct": -3.6,
                    "shimmer_change_pct": -4.2,
                    "overall_deviation_pct": 9.4,
                    "alert_level": "green",
                },
                "alert_level": "green",
                "confidence": "medium",
                "transcript": "The sun was warm on the old stone wall. Margaret picked up her cup of tea and watched the birds in the garden. It was a quiet morning, and she was glad of it.",
                "narrative": (
                    "Recording duration: 48.3s. Speech occupied 80.5% of the recording. "
                    "5 pause(s) detected with mean duration 1.88s. Mean pitch: 200 Hz. "
                    "Compared to baseline: speech rate changed by +2.6%, pause duration changed by -9.4%. "
                    "Voice biomarkers are within normal range of baseline. Margaret's read-aloud performance was "
                    "clear and well-paced. Prosody was natural with appropriate intonation contours. Vocal quality "
                    "remained stable throughout with no fatigue indicators."
                ),
            },
            {
                "days_ago": 7,
                "features": {
                    "duration_s": 44.1,
                    "speech_duration_s": 35.6,
                    "pause_duration_s": 8.5,
                    "pause_count": 4,
                    "mean_pause_duration_s": 2.125,
                    "speech_rate_proxy": 3.45,
                    "mean_energy": 1810.8,
                    "energy_std": 408.5,
                    "vocal_fatigue_index": 0.91,
                    "pitch_mean_hz": 197.8,
                    "pitch_std_hz": 14.0,
                    "jitter_pct": 1.15,
                    "shimmer_pct": 2.90,
                    "zcr_mean": 1238.0,
                    "spectral_centroid_hz": 1672.5,
                },
                "risk_scores": {
                    "speech_rate_change_pct": 0.9,
                    "pause_duration_change_pct": 2.4,
                    "energy_change_pct": -0.5,
                    "pitch_change_pct": -0.3,
                    "jitter_change_pct": 2.7,
                    "shimmer_change_pct": 2.1,
                    "overall_deviation_pct": 2.4,
                    "alert_level": "green",
                },
                "alert_level": "green",
                "confidence": "high",
                "transcript": "One, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
                "narrative": (
                    "Recording duration: 44.1s. Speech occupied 80.7% of the recording. "
                    "4 pause(s) detected with mean duration 2.13s. Mean pitch: 198 Hz. "
                    "Compared to baseline: speech rate changed by +0.9%, pause duration changed by +2.4%. "
                    "Voice biomarkers remain consistently within normal range across four recordings. Baseline is now "
                    "well-established with high confidence. Margaret's vocal profile is stable — no clinical concerns. "
                    "This is a trend monitoring tool, not a diagnostic device."
                ),
            },
        ],
    },
    {
        "resident_id": "R002",
        "display_name": "Harold Wilson",
        "facility_id": "default",
        "password": "4321",
        "analyses": [
            {
                "days_ago": 21,
                "features": {
                    "duration_s": 50.2,
                    "speech_duration_s": 38.4,
                    "pause_duration_s": 11.8,
                    "pause_count": 7,
                    "mean_pause_duration_s": 1.686,
                    "speech_rate_proxy": 2.95,
                    "mean_energy": 1540.3,
                    "energy_std": 380.1,
                    "vocal_fatigue_index": 0.88,
                    "pitch_mean_hz": 142.6,
                    "pitch_std_hz": 11.3,
                    "jitter_pct": 1.85,
                    "shimmer_pct": 3.42,
                    "zcr_mean": 980.5,
                    "spectral_centroid_hz": 1420.8,
                },
                "risk_scores": {},
                "alert_level": "green",
                "confidence": "low",
                "transcript": "One, two, three, four, five, six... seven, eight, nine, ten, eleven, twelve, thirteen... fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
                "narrative": (
                    "Recording duration: 50.2s. Speech occupied 76.5% of the recording. "
                    "7 pause(s) detected with mean duration 1.69s. Mean pitch: 143 Hz. "
                    "This is the baseline recording. Harold spoke at a measured pace with natural pausing. "
                    "Pitch and energy levels are within typical range for male elderly speech. "
                    "Slight vocal roughness noted but consistent throughout — likely habitual rather than pathological."
                ),
            },
            {
                "days_ago": 14,
                "features": {
                    "duration_s": 58.4,
                    "speech_duration_s": 40.2,
                    "pause_duration_s": 18.2,
                    "pause_count": 11,
                    "mean_pause_duration_s": 1.655,
                    "speech_rate_proxy": 2.48,
                    "mean_energy": 1410.6,
                    "energy_std": 425.3,
                    "vocal_fatigue_index": 0.76,
                    "pitch_mean_hz": 138.2,
                    "pitch_std_hz": 16.8,
                    "jitter_pct": 2.41,
                    "shimmer_pct": 4.15,
                    "zcr_mean": 945.2,
                    "spectral_centroid_hz": 1385.4,
                },
                "risk_scores": {
                    "speech_rate_change_pct": -15.9,
                    "pause_duration_change_pct": -1.8,
                    "energy_change_pct": -8.4,
                    "pitch_change_pct": -3.1,
                    "jitter_change_pct": 30.3,
                    "shimmer_change_pct": 21.3,
                    "overall_deviation_pct": 15.9,
                    "alert_level": "amber",
                },
                "alert_level": "amber",
                "confidence": "medium",
                "transcript": "My favourite meal... it would be... the fish and chips from the RSL club. We used to go every Friday, me and... and Barbara. She always had the barramundi. I'd have the flathead. With extra tartare sauce.",
                "narrative": (
                    "Recording duration: 58.4s. Speech occupied 68.8% of the recording. "
                    "11 pause(s) detected with mean duration 1.66s. Mean pitch: 138 Hz. "
                    "Elevated jitter detected, suggesting vocal instability or tremor. "
                    "Compared to baseline: speech rate changed by -15.9%, pause duration changed by -1.8%. "
                    "These changes warrant continued monitoring. Harold's speech rate has decreased notably from baseline, "
                    "with increased pause frequency (7→11) and elevated jitter (1.85→2.41%). The combination of slowed "
                    "speech and increased vocal tremor may indicate early motor speech changes. Consider scheduling a "
                    "clinical assessment if the trend persists. Recommend Barthel re-assessment for functional status "
                    "and falls risk review. This analysis is a clinical decision support tool."
                ),
            },
            {
                "days_ago": 7,
                "features": {
                    "duration_s": 52.1,
                    "speech_duration_s": 35.8,
                    "pause_duration_s": 16.3,
                    "pause_count": 10,
                    "mean_pause_duration_s": 1.63,
                    "speech_rate_proxy": 2.52,
                    "mean_energy": 1380.4,
                    "energy_std": 440.8,
                    "vocal_fatigue_index": 0.73,
                    "pitch_mean_hz": 136.5,
                    "pitch_std_hz": 18.2,
                    "jitter_pct": 2.58,
                    "shimmer_pct": 4.38,
                    "zcr_mean": 932.1,
                    "spectral_centroid_hz": 1362.7,
                },
                "risk_scores": {
                    "speech_rate_change_pct": -14.6,
                    "pause_duration_change_pct": -3.3,
                    "energy_change_pct": -10.4,
                    "pitch_change_pct": -4.3,
                    "jitter_change_pct": 39.5,
                    "shimmer_change_pct": 28.1,
                    "overall_deviation_pct": 14.6,
                    "alert_level": "amber",
                },
                "alert_level": "amber",
                "confidence": "medium",
                "transcript": "The sun was warm on the old stone wall. Margaret... sorry... Margaret picked up her cup of tea and watched the birds in the garden. It was a quiet morning and she was... glad of it.",
                "narrative": (
                    "Recording duration: 52.1s. Speech occupied 68.7% of the recording. "
                    "10 pause(s) detected with mean duration 1.63s. Mean pitch: 137 Hz. "
                    "Elevated jitter detected, suggesting vocal instability or tremor. "
                    "Vocal fatigue detected: energy dropped significantly toward the end of the recording. "
                    "Compared to baseline: speech rate changed by -14.6%, pause duration changed by -3.3%. "
                    "Harold's speech rate remains reduced from baseline with persistent vocal tremor in the phonatory "
                    "dimension. The reading task showed a self-correction ('Margaret... sorry... Margaret'), suggesting "
                    "linguistic-dimension hesitation. Vocal fatigue index of 0.73 indicates declining energy across the "
                    "recording. Continued monitoring is warranted. Consider referral for speech pathology assessment and "
                    "medication review. This is a trend monitoring tool, not a diagnostic device."
                ),
            },
        ],
    },
    {
        "resident_id": "R003",
        "display_name": "Dorothy Evans",
        "facility_id": "default",
        "password": "5678",
        "analyses": [
            {
                "days_ago": 14,
                "features": {
                    "duration_s": 38.7,
                    "speech_duration_s": 30.1,
                    "pause_duration_s": 8.6,
                    "pause_count": 5,
                    "mean_pause_duration_s": 1.72,
                    "speech_rate_proxy": 3.15,
                    "mean_energy": 1650.8,
                    "energy_std": 360.4,
                    "vocal_fatigue_index": 0.95,
                    "pitch_mean_hz": 210.5,
                    "pitch_std_hz": 12.1,
                    "jitter_pct": 0.98,
                    "shimmer_pct": 2.45,
                    "zcr_mean": 1320.8,
                    "spectral_centroid_hz": 1750.2,
                },
                "risk_scores": {},
                "alert_level": "green",
                "confidence": "low",
                "transcript": "One, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty.",
                "narrative": (
                    "Recording duration: 38.7s. Speech occupied 77.8% of the recording. "
                    "5 pause(s) detected with mean duration 1.72s. Mean pitch: 211 Hz. "
                    "This is the baseline recording. Dorothy demonstrated clear, well-paced speech with "
                    "consistent vocal quality throughout. Pitch and energy levels are within healthy range. "
                    "No signs of vocal fatigue or speech irregularity detected."
                ),
            },
            {
                "days_ago": 3,
                "features": {
                    "duration_s": 60.0,
                    "speech_duration_s": 32.4,
                    "pause_duration_s": 27.6,
                    "pause_count": 18,
                    "mean_pause_duration_s": 1.533,
                    "speech_rate_proxy": 1.85,
                    "mean_energy": 1120.3,
                    "energy_std": 520.7,
                    "vocal_fatigue_index": 0.52,
                    "pitch_mean_hz": 185.2,
                    "pitch_std_hz": 28.4,
                    "jitter_pct": 3.72,
                    "shimmer_pct": 6.15,
                    "zcr_mean": 1085.3,
                    "spectral_centroid_hz": 1520.6,
                },
                "risk_scores": {
                    "speech_rate_change_pct": -41.3,
                    "pause_duration_change_pct": -10.9,
                    "energy_change_pct": -32.1,
                    "pitch_change_pct": -12.0,
                    "jitter_change_pct": 279.6,
                    "shimmer_change_pct": 151.0,
                    "overall_deviation_pct": 41.3,
                    "alert_level": "red",
                },
                "alert_level": "red",
                "confidence": "medium",
                "transcript": "My favourite meal... um... I like... the soup. The soup that... the lady makes. With the... bread. I can't remember what it's called. It's nice though. We have it... on... the cold days.",
                "narrative": (
                    "URGENT — Significant voice biomarker deviation detected. "
                    "Recording duration: 60.0s. Speech occupied only 54.0% of the recording (baseline: 77.8%). "
                    "18 pause(s) detected (baseline: 5) with mean duration 1.53s. Mean pitch: 185 Hz (baseline: 211 Hz). "
                    "Elevated jitter (3.72%) and shimmer (6.15%) detected, indicating vocal instability and "
                    "irregular vocal amplitude — possible laryngeal changes. "
                    "Vocal fatigue detected: energy dropped to 52% of initial levels by end of recording. "
                    "Compared to baseline: speech rate dropped by -41.3%, energy decreased by -32.1%, pitch dropped by -12.0%. "
                    "These changes significantly exceed monitoring thresholds. Dorothy's speech shows marked deterioration "
                    "from baseline across all acoustic dimensions. The dramatic increase in pause frequency (5→18), "
                    "combined with linguistic-dimension hesitation in the transcript ('I can't remember what it's called'), "
                    "severe vocal fatigue, and substantially increased jitter/shimmer, suggest a sustained cross-dimension "
                    "voice shift. The phonatory, articulatory, prosodic, and linguistic dimensions are all affected. "
                    "IMMEDIATE CLINICAL ASSESSMENT RECOMMENDED. Recommend: urgent medical review and medication "
                    "reconciliation. This is a trend monitoring tool, not a diagnostic device. "
                    "All flagged voice changes require clinical assessment by a qualified health professional."
                ),
            },
        ],
    },
]


def seed_demo_data() -> None:
    """Populate storage with 3 demo residents if none exist yet.
    Works with both Azure Table Storage and in-memory fallback."""
    # Check if any profile already exists (Azure or in-memory)
    existing = voice_profile_db.get_by_resident_id("R001")
    if existing:
        logger.info("Voice seed: demo residents already exist, skipping.")
        return

    logger.info("Seeding 3 demo voice residents...")

    for demo in DEMO_RESIDENTS:
        # Create profile
        profile = voice_profile_db.create_profile(
            resident_id=demo["resident_id"],
            facility_id=demo["facility_id"],
            display_name=demo["display_name"],
            password_hash=hash_password(demo["password"]),
        )
        profile_id = profile["profile_id"]

        # Create a used link for each resident
        now = datetime.now(timezone.utc)
        link = voice_link_db.create_link(
            resident_id=demo["resident_id"],
            facility_id=demo["facility_id"],
            generated_by="demo-nurse",
            expires_at=(now + timedelta(days=30)).isoformat(),
        )
        voice_link_db.mark_used(link["token"])

        # Create analyses (oldest first so ordering is correct)
        analyses = sorted(demo["analyses"], key=lambda a: a["days_ago"], reverse=True)
        recording_count = 0
        for analysis in analyses:
            recording_count += 1

            # Use the create_analysis API which works with both Azure and in-memory
            import uuid
            recording_id = str(uuid.uuid4())
            voice_analysis_db.create_analysis(
                recording_id=recording_id,
                profile_id=profile_id,
                acoustic_features=analysis["features"],
                risk_scores=analysis["risk_scores"],
                narrative_report=analysis["narrative"],
                alert_level=analysis["alert_level"],
                confidence=analysis["confidence"],
                facility_id=demo["facility_id"],
                resident_id=demo["resident_id"],
                display_name=demo["display_name"],
                transcript=analysis.get("transcript"),
            )

        # Update profile metadata
        voice_profile_db.update_profile(profile_id, {
            "last_recording_date": (now - timedelta(days=analyses[-1]["days_ago"])).isoformat(),
            "baseline_recording_count": recording_count,
            "baseline_established": recording_count >= 2,
        })

    logger.info("Seeded %d demo voice residents.", len(DEMO_RESIDENTS))
