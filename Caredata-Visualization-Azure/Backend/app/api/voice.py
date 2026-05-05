"""
Voice Biomarker Screening API — Phase 2.

Endpoints for:
- Recording link generation (nurse auth)
- Resident authentication (link-token-based)
- Audio recording upload, playback, and retrieval (resident auth)
- Analysis results, alerts, and PDF reports (nurse auth)
- Consent workflow
- Password reset (nurse auth)
- Whisper transcription + LLM narrative (optional, when keys set)
- QI integration flags
"""
import io
import logging
import os
import random
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.services.jwt_auth import create_access_token, get_current_user, verify_token
from app.services import (
    voice_analysis_db,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
)
from app.services.voice_processor import (
    compare_to_baseline,
    determine_confidence,
    extract_acoustic_features,
    generate_narrative,
)

router = APIRouter(prefix="/api/voice", tags=["Voice Biomarker"])
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB

# ---------------------------------------------------------------------------
# Voice prompts (hardcoded for MVP)
# ---------------------------------------------------------------------------
PROMPTS = [
    {
        "id": "count",
        "type": "sequencing",
        "text": "Please count from one to twenty at your normal speaking pace.",
    },
    {
        "id": "meal",
        "type": "open_response",
        "text": "Please tell me about your favourite meal. What was it, and who were you with?",
    },
    {
        "id": "read",
        "type": "read_aloud",
        "text": (
            "Please read aloud: The sun was warm on the old stone wall. "
            "Margaret picked up her cup of tea and watched the birds in the garden. "
            "It was a quiet morning, and she was glad of it."
        ),
    },
]

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LinkRequest(BaseModel):
    resident_id: str
    facility_id: str = "default"


class BatchLinkRequest(BaseModel):
    resident_ids: list[str]
    facility_id: str = "default"


class ResidentRegisterRequest(BaseModel):
    token: str
    display_name: str
    password: str  # 4-char minimum


class ResidentLoginRequest(BaseModel):
    resident_id: str
    password: str


class ResetPasswordRequest(BaseModel):
    resident_id: str
    new_password: str  # 4-char minimum


class ConsentRequest(BaseModel):
    consent_given: bool  # True = consent granted, False = withdrawn


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------


def get_current_resident(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """Dependency: validate JWT and require role=resident."""
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    payload = verify_token(credentials.credentials)
    if payload.get("role") != "resident":
        raise HTTPException(403, "Resident access required")
    return payload


# ---------------------------------------------------------------------------
# 1-3: Link management (nurse auth)
# ---------------------------------------------------------------------------


@router.post("/links")
def generate_link(
    body: LinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a single recording link for a resident."""
    expiry_hours = getattr(settings, "VOICE_LINK_EXPIRY_HOURS", 168)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
    link = voice_link_db.create_link(
        resident_id=body.resident_id,
        facility_id=body.facility_id,
        generated_by=current_user.get("sub", ""),
        expires_at=expires_at,
    )
    base_url = getattr(settings, "VOICE_LINK_BASE_URL", "http://localhost:5173")
    token = link["token"]
    return {
        "token": token,
        "url": f"{base_url}/voice/record/{token}",
        "resident_id": body.resident_id,
        "expires_at": expires_at,
    }


@router.post("/links/batch")
def generate_links_batch(
    body: BatchLinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate recording links for multiple residents."""
    expiry_hours = getattr(settings, "VOICE_LINK_EXPIRY_HOURS", 168)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
    base_url = getattr(settings, "VOICE_LINK_BASE_URL", "http://localhost:5173")
    results = []
    for rid in body.resident_ids:
        link = voice_link_db.create_link(
            resident_id=rid,
            facility_id=body.facility_id,
            generated_by=current_user.get("sub", ""),
            expires_at=expires_at,
        )
        token = link["token"]
        results.append({
            "token": token,
            "url": f"{base_url}/voice/record/{token}",
            "resident_id": rid,
            "expires_at": expires_at,
        })
    return {"links": results}


@router.get("/links/{token}")
def validate_link(token: str):
    """Validate a recording link (no auth required). Returns link status and resident profile info."""
    link = voice_link_db.get_link(token)
    if not link:
        raise HTTPException(404, "Link not found")

    now = datetime.now(timezone.utc)
    expires_at = link.get("expires_at", "")
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        expired = now > exp
    except (ValueError, TypeError):
        expired = True

    if link.get("used"):
        # Still valid if resident already registered — they can re-use
        profile = voice_profile_db.get_by_resident_id(link["resident_id"])
        return {
            "valid": True,
            "status": "used",
            "resident_id": link["resident_id"],
            "has_account": profile is not None,
            "display_name": profile.get("display_name") if profile else None,
            "expires_at": expires_at,
        }

    if expired:
        return {
            "valid": False,
            "status": "expired",
            "resident_id": link["resident_id"],
            "message": "This link has expired. Please ask your nurse for a new one.",
        }

    # Check if resident already has an account
    profile = voice_profile_db.get_by_resident_id(link["resident_id"])
    return {
        "valid": True,
        "status": "active",
        "resident_id": link["resident_id"],
        "has_account": profile is not None,
        "display_name": profile.get("display_name") if profile else None,
        "expires_at": expires_at,
    }


# ---------------------------------------------------------------------------
# 4-5: Resident auth
# ---------------------------------------------------------------------------


@router.post("/residents/register")
def register_resident(body: ResidentRegisterRequest):
    """Create a resident voice account using a valid link token."""
    link = voice_link_db.get_link(body.token)
    if not link:
        raise HTTPException(400, "Invalid link token")

    # Check expiry
    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00"))
        if now > exp:
            raise HTTPException(400, "Link has expired")
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid link expiry")

    if len(body.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")

    resident_id = link["resident_id"]
    facility_id = link.get("facility_id", "default")

    # Check if already registered
    existing = voice_profile_db.get_by_resident_id(resident_id)
    if existing:
        raise HTTPException(400, "Account already exists. Please log in instead.")

    profile = voice_profile_db.create_profile(
        resident_id=resident_id,
        facility_id=facility_id,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )

    # Mark link as used
    voice_link_db.mark_used(body.token)

    # Issue resident JWT
    token = create_access_token({
        "sub": profile["profile_id"],
        "role": "resident",
        "profile_id": profile["profile_id"],
        "resident_id": resident_id,
        "facility_id": facility_id,
        "display_name": body.display_name,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "profile": {
            "profile_id": profile["profile_id"],
            "resident_id": resident_id,
            "display_name": body.display_name,
        },
    }


@router.post("/residents/login")
def login_resident(body: ResidentLoginRequest):
    """Authenticate a resident and return JWT."""
    profile = voice_profile_db.get_by_resident_id(body.resident_id)
    if not profile:
        raise HTTPException(401, "Account not found")

    if not verify_password(body.password, profile["password_hash"]):
        raise HTTPException(401, "Invalid password")

    token = create_access_token({
        "sub": profile["profile_id"],
        "role": "resident",
        "profile_id": profile["profile_id"],
        "resident_id": profile["resident_id"],
        "facility_id": profile.get("facility_id", ""),
        "display_name": profile.get("display_name", ""),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "profile": {
            "profile_id": profile["profile_id"],
            "resident_id": profile["resident_id"],
            "display_name": profile.get("display_name"),
        },
    }


# ---------------------------------------------------------------------------
# Password reset (nurse auth)
# ---------------------------------------------------------------------------


@router.post("/residents/reset-password")
def reset_resident_password(
    body: ResetPasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Nurse resets a resident's password."""
    if len(body.new_password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    profile = voice_profile_db.get_by_resident_id(body.resident_id)
    if not profile:
        raise HTTPException(404, "Resident not found")
    voice_profile_db.update_profile(profile["profile_id"], {
        "password_hash": hash_password(body.new_password),
    })
    return {"reset": True, "resident_id": body.resident_id}


# ---------------------------------------------------------------------------
# Consent (resident auth)
# ---------------------------------------------------------------------------


@router.put("/consent")
def update_consent(
    body: ConsentRequest,
    current_resident: dict = Depends(get_current_resident),
):
    """Resident grants or withdraws consent for voice recording."""
    profile_id = current_resident.get("profile_id")
    status = "active" if body.consent_given else "withdrawn"
    voice_profile_db.update_profile(profile_id, {"consent_status": status})
    return {"consent_status": status}


@router.get("/consent")
def get_consent(current_resident: dict = Depends(get_current_resident)):
    """Check resident's current consent status."""
    profile_id = current_resident.get("profile_id")
    profile = voice_profile_db.get_by_id(profile_id)
    return {"consent_status": profile.get("consent_status", "pending") if profile else "unknown"}


# ---------------------------------------------------------------------------
# 6-8: Recordings (resident auth)
# ---------------------------------------------------------------------------


@router.post("/recordings")
async def upload_recording(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_resident: dict = Depends(get_current_resident),
):
    """Upload a voice recording. Triggers async analysis."""
    profile_id = current_resident.get("profile_id")
    if not profile_id:
        raise HTTPException(401, "Invalid resident token")

    content = await file.read()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "File too large (max 5 MB)")

    # Select a random prompt
    prompt = random.choice(PROMPTS)

    # Save audio to filesystem
    upload_dir = getattr(settings, "VOICE_UPLOAD_DIR", "voice_uploads")
    profile_dir = os.path.join(upload_dir, profile_id)
    os.makedirs(profile_dir, exist_ok=True)

    import uuid
    recording_id_hint = str(uuid.uuid4())
    file_path = os.path.join(profile_dir, f"{recording_id_hint}.wav")

    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except OSError:
        # Filesystem not available — use in-memory fallback
        file_path = f"memory://{recording_id_hint}"
        voice_recording_db.store_audio(recording_id_hint, content)

    # Estimate duration from WAV header
    duration_s = 0.0
    try:
        import io
        import wave
        with wave.open(io.BytesIO(content), "rb") as wf:
            duration_s = wf.getnframes() / wf.getframerate()
    except Exception:
        pass

    recording = voice_recording_db.create_recording(
        profile_id=profile_id,
        duration_s=round(duration_s, 2),
        prompt_id=prompt["id"],
        audio_file_path=file_path,
    )

    # Trigger background analysis
    background_tasks.add_task(
        _process_recording,
        recording["recording_id"],
        profile_id,
        content,
        current_resident,
    )

    return {
        "recording_id": recording["recording_id"],
        "duration_s": recording["duration_s"],
        "prompt": prompt,
        "status": "processing",
    }


@router.get("/recordings")
def list_recordings(current_resident: dict = Depends(get_current_resident)):
    """List the resident's own recordings."""
    profile_id = current_resident.get("profile_id")
    recordings = voice_recording_db.list_recordings(profile_id)
    return {"recordings": recordings}


@router.delete("/recordings/{recording_id}")
def delete_recording(
    recording_id: str,
    current_resident: dict = Depends(get_current_resident),
):
    """Delete a resident's own recording."""
    profile_id = current_resident.get("profile_id")
    rec = voice_recording_db.get_recording(profile_id, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    # Delete audio file from filesystem
    path = rec.get("audio_file_path", "")
    if path and not path.startswith("memory://"):
        try:
            os.remove(path)
        except OSError:
            pass

    voice_recording_db.delete_recording(profile_id, recording_id)
    return {"deleted": True}


@router.get("/recordings/{recording_id}/audio")
def stream_audio(
    recording_id: str,
    current_resident: dict = Depends(get_current_resident),
):
    """Stream audio playback for a recording (resident auth only)."""
    profile_id = current_resident.get("profile_id")
    rec = voice_recording_db.get_recording(profile_id, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    path = rec.get("audio_file_path", "")
    if path and not path.startswith("memory://") and os.path.isfile(path):
        def file_iter():
            with open(path, "rb") as f:
                while chunk := f.read(64 * 1024):
                    yield chunk
        return StreamingResponse(file_iter(), media_type="audio/wav")

    # In-memory fallback
    audio = voice_recording_db.get_audio(recording_id)
    if audio:
        return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")

    raise HTTPException(404, "Audio file not available")


# ---------------------------------------------------------------------------
# Prompt endpoint (public — no auth, used by recording page)
# ---------------------------------------------------------------------------


@router.get("/prompts/random")
def get_random_prompt():
    """Return a random voice prompt for the recording session."""
    return random.choice(PROMPTS)


# ---------------------------------------------------------------------------
# 9-12: Analysis & alerts (nurse auth)
# ---------------------------------------------------------------------------


@router.get("/analysis/{resident_id}")
def get_analysis(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the latest voice analysis for a resident."""
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if not profile:
        raise HTTPException(404, "Resident voice profile not found")

    analysis = voice_analysis_db.get_latest(profile["profile_id"])
    if not analysis:
        raise HTTPException(404, "No analysis results yet")
    return analysis


@router.get("/analysis/{resident_id}/history")
def get_analysis_history(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all voice analyses for a resident (for trend charts)."""
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if not profile:
        raise HTTPException(404, "Resident voice profile not found")

    analyses = voice_analysis_db.list_analyses(profile["profile_id"])
    return {"analyses": analyses, "profile": {
        "profile_id": profile["profile_id"],
        "resident_id": resident_id,
        "display_name": profile.get("display_name"),
        "baseline_established": profile.get("baseline_established", False),
        "recording_count": profile.get("baseline_recording_count", 0),
    }}


@router.get("/analysis/{resident_id}/report")
def get_pdf_report(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate a downloadable PDF risk report for a resident."""
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if not profile:
        raise HTTPException(404, "Resident voice profile not found")
    analyses = voice_analysis_db.list_analyses(profile["profile_id"])
    if not analyses:
        raise HTTPException(404, "No analysis results yet")

    latest = analyses[0]
    features = latest.get("acoustic_features", {})
    risk = latest.get("risk_scores", {})
    display_name = latest.get("display_name") or resident_id

    # Build simple HTML report → convert to PDF-like response
    html = _build_report_html(display_name, resident_id, latest, analyses)
    buf = io.BytesIO(html.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="voice_report_{resident_id}.html"'},
    )


# ---------------------------------------------------------------------------
# Links listing (nurse auth — for dashboard select box)
# ---------------------------------------------------------------------------


@router.get("/links")
def list_links(current_user: dict = Depends(get_current_user)):
    """List all links generated by this nurse (for resident select dropdown)."""
    nurse_id = current_user.get("sub", "")
    links = voice_link_db.list_by_nurse(nurse_id)
    # Also include all links if nurse_id filter returns nothing (dev fallback)
    if not links:
        links = voice_link_db.list_all()
    return {"links": links}


@router.get("/alerts")
def get_alerts(current_user: dict = Depends(get_current_user)):
    """Get unacknowledged voice biomarker alerts."""
    alerts = voice_analysis_db.list_alerts(facility_id=None, acknowledged=False)
    return {"alerts": alerts}


@router.put("/alerts/{analysis_id}/acknowledge")
def acknowledge_alert(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Acknowledge a voice biomarker alert."""
    # Find the analysis to get profile_id
    # Try all profiles — alerts list already gives us the data
    alerts = voice_analysis_db.list_alerts(acknowledged=False)
    target = next((a for a in alerts if a["analysis_id"] == analysis_id), None)
    if not target:
        raise HTTPException(404, "Alert not found or already acknowledged")

    success = voice_analysis_db.acknowledge_alert(
        profile_id=target["profile_id"],
        analysis_id=analysis_id,
        acknowledged_by=current_user.get("sub", ""),
    )
    if not success:
        raise HTTPException(500, "Failed to acknowledge alert")
    return {"acknowledged": True}


# ---------------------------------------------------------------------------
# Facility summary (nurse auth)
# ---------------------------------------------------------------------------


@router.get("/facility/summary")
def facility_summary(current_user: dict = Depends(get_current_user)):
    """Aggregate voice biomarker stats across all residents."""
    # Get all profiles (facility-wide)
    # For MVP, we list all profiles since facility_id filtering is optional
    all_alerts = voice_analysis_db.list_alerts(acknowledged=False)
    # Count unique profiles with recordings
    # This is a simple summary for the dashboard header
    return {
        "active_alerts": len(all_alerts),
        "red_alerts": len([a for a in all_alerts if a["alert_level"] == "red"]),
        "amber_alerts": len([a for a in all_alerts if a["alert_level"] == "amber"]),
    }


@router.get("/residents")
def list_voice_residents(current_user: dict = Depends(get_current_user)):
    """List all residents with voice profiles (for nurse dashboard)."""
    # For MVP, list all profiles (no facility filter)
    profiles = []
    # Get from in-memory or Azure
    # We need to scan all profiles — use a broad query
    table = voice_profile_db._get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter="PartitionKey eq 'resident'"
            ))
            profiles = [voice_profile_db._entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("list_voice_residents: %s", e)
    else:
        profiles = [dict(p) for p in voice_profile_db._in_memory.values()]

    # Attach latest analysis to each profile
    result = []
    for p in profiles:
        latest = voice_analysis_db.get_latest(p["profile_id"])
        result.append({
            "profile_id": p["profile_id"],
            "resident_id": p.get("resident_id"),
            "display_name": p.get("display_name"),
            "last_recording_date": p.get("last_recording_date"),
            "baseline_established": p.get("baseline_established", False),
            "recording_count": p.get("baseline_recording_count", 0),
            "latest_analysis": latest,
        })

    return {"residents": result}


# ---------------------------------------------------------------------------
# Background task: process recording
# ---------------------------------------------------------------------------


def _process_recording(
    recording_id: str,
    profile_id: str,
    audio_bytes: bytes,
    resident_payload: dict,
):
    """Background task: extract features, transcribe, compare baseline, generate narrative, store analysis."""
    try:
        voice_recording_db.update_status(profile_id, recording_id, "processing")

        # Extract acoustic features
        features = extract_acoustic_features(audio_bytes)
        logger.info("Extracted features for %s: %s", recording_id, features)

        # Attempt Whisper transcription (optional — requires OPENAI_API_KEY)
        transcript = _try_whisper_transcription(audio_bytes, recording_id)

        # Get existing analyses for baseline comparison
        existing = voice_analysis_db.list_analyses(profile_id)
        baseline_analysis = existing[-1] if existing else None  # Oldest = baseline

        risk_scores = {}
        alert_level = "green"
        if baseline_analysis:
            baseline_features = baseline_analysis.get("acoustic_features", {})
            risk_scores = compare_to_baseline(features, baseline_features)
            alert_level = risk_scores.get("alert_level", "green")

        recording_count = len(existing) + 1
        confidence = determine_confidence(recording_count)

        # Generate narrative — try LLM first, fall back to template
        narrative = _try_llm_narrative(
            features, risk_scores if baseline_analysis else None,
            transcript, resident_payload, alert_level,
        )
        if not narrative:
            narrative = generate_narrative(
                features, risk_scores if baseline_analysis else None, transcript
            )

        # Store analysis (include transcript)
        analysis = voice_analysis_db.create_analysis(
            recording_id=recording_id,
            profile_id=profile_id,
            acoustic_features=features,
            risk_scores=risk_scores,
            narrative_report=narrative,
            alert_level=alert_level,
            confidence=confidence,
            facility_id=resident_payload.get("facility_id"),
            resident_id=resident_payload.get("resident_id"),
            display_name=resident_payload.get("display_name"),
            transcript=transcript,
        )

        # Update recording status
        voice_recording_db.update_status(profile_id, recording_id, "analyzed")

        # Update profile metadata
        voice_profile_db.update_profile(profile_id, {
            "last_recording_date": datetime.now(timezone.utc).isoformat(),
            "baseline_recording_count": recording_count,
            "baseline_established": recording_count >= 2,
        })

        logger.info(
            "Analysis complete for recording %s: alert_level=%s, transcript=%s",
            recording_id,
            alert_level,
            "yes" if transcript else "no",
        )

    except Exception:
        logger.exception("Failed to process recording %s", recording_id)
        voice_recording_db.update_status(profile_id, recording_id, "failed")


# ---------------------------------------------------------------------------
# Optional: Whisper transcription
# ---------------------------------------------------------------------------


def _try_whisper_transcription(audio_bytes: bytes, recording_id: str) -> str | None:
    """Attempt to transcribe audio using OpenAI Whisper API. Returns transcript or None."""
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        return None
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = f"{recording_id}.wav"
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
        )
        transcript = result.text.strip() if result.text else None
        logger.info("Whisper transcript for %s: %s chars", recording_id, len(transcript) if transcript else 0)
        return transcript
    except Exception as e:
        logger.warning("Whisper transcription failed for %s: %s", recording_id, e)
        return None


# ---------------------------------------------------------------------------
# Optional: LLM-generated clinical narrative
# ---------------------------------------------------------------------------


def _try_llm_narrative(
    features: dict,
    risk_scores: dict | None,
    transcript: str | None,
    resident: dict,
    alert_level: str,
) -> str | None:
    """Try to generate a clinical narrative using OpenAI GPT-4o. Returns narrative or None."""
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        return None
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)

        prompt = f"""You are a clinical decision support system for aged care. Generate a concise clinical narrative
(3-5 sentences) based on this voice biomarker analysis for an aged care resident.

Resident: {resident.get('display_name', 'Unknown')} (ID: {resident.get('resident_id', 'N/A')})
Alert Level: {alert_level}

Acoustic Features:
- Speech rate: {features.get('speech_rate_proxy', 0)}/s
- Mean pause duration: {features.get('mean_pause_duration_s', 0):.2f}s
- Pause count: {features.get('pause_count', 0)}
- Mean pitch: {features.get('pitch_mean_hz', 0):.0f} Hz
- Jitter: {features.get('jitter_pct', 0):.2f}%
- Shimmer: {features.get('shimmer_pct', 0):.2f}%
- Vocal fatigue index: {features.get('vocal_fatigue_index', 1.0):.2f}
"""
        if risk_scores:
            prompt += f"""
Baseline Comparison:
- Speech rate change: {risk_scores.get('speech_rate_change_pct', 0):+.1f}%
- Pause duration change: {risk_scores.get('pause_duration_change_pct', 0):+.1f}%
- Overall deviation: {risk_scores.get('overall_deviation_pct', 0):.1f}%
"""
        if transcript:
            prompt += f"\nTranscript: \"{transcript[:500]}\"\n"

        prompt += """
Focus on: which voice dimensions (phonatory / articulatory / prosodic / respiratory /
linguistic) have shifted relative to baseline, the magnitude of the shift, and recommended
next steps for the nurse (e.g. clinical re-assessment, GP review, hydration check). Do NOT
name any neurological or psychiatric condition. Frame everything as 'voice quality changes
flagged for nurse review'. End with: 'This is a trend monitoring tool, not a diagnostic device.'"""  # FRAMING_OK

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        narrative = response.choices[0].message.content.strip()
        logger.info("LLM narrative generated for %s", resident.get("resident_id"))
        return narrative
    except Exception as e:
        logger.warning("LLM narrative generation failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# QI Integration — voice biomarker flags
# ---------------------------------------------------------------------------


@router.get("/qi-flags")
def get_qi_flags(current_user: dict = Depends(get_current_user)):
    """
    Return voice biomarker flags that integrate with the QI dashboard.
    Maps voice changes to QI categories: ADL decline, fall risk, medication review, ED prevention, QOL.
    """
    all_alerts = voice_analysis_db.list_alerts(acknowledged=False)
    profiles_table = voice_profile_db._get_table()
    if profiles_table:
        try:
            all_profiles = [voice_profile_db._entity_to_dict(e) for e in profiles_table.query_entities(
                query_filter="PartitionKey eq 'resident'"
            )]
        except Exception:
            all_profiles = []
    else:
        all_profiles = [dict(p) for p in voice_profile_db._in_memory.values()]

    flags = []
    for alert in all_alerts:
        risk = alert.get("risk_scores", {})
        features = alert.get("acoustic_features", {})
        level = alert.get("alert_level", "green")
        resident_id = alert.get("resident_id", "")
        name = alert.get("display_name", resident_id)

        qi_links = []
        # Speech rate + pause → ADL decline (Barthel)
        sr_change = abs(risk.get("speech_rate_change_pct", 0))
        pd_change = abs(risk.get("pause_duration_change_pct", 0))
        en_change = abs(risk.get("energy_change_pct", 0))

        if sr_change > 20 or pd_change > 20:
            qi_links.append({
                "qi_category": "QI 06 — ADL (Barthel)",
                "indicator": "ADL_01",
                "flag": "Voice-detected motor speech changes — recommend early Barthel re-assessment",
                "severity": level,
            })
        if pd_change > 25:
            qi_links.append({
                "qi_category": "QI 04 — Falls",
                "indicator": "FALL_01",
                "flag": "Speech rhythm irregularity correlated with balance/gait issues — flag as fall risk modifier",
                "severity": level,
            })
        if en_change > 30:
            qi_links.append({
                "qi_category": "QI 05 — Medications",
                "indicator": "MED_AP",
                "flag": "Voice energy changes may indicate sedation — trigger antipsychotic medication review",
                "severity": level,
            })
        if level == "red":
            qi_links.append({
                "qi_category": "QI 08 — Hospitalisation",
                "indicator": "HOSP_ED",
                "flag": "Acute multi-dimensional voice shift — escalate to clinical review",
                "severity": "red",
            })
        fatigue = features.get("vocal_fatigue_index", 1.0)
        if fatigue < 0.7:
            qi_links.append({
                "qi_category": "QI 11 — Quality of Life",
                "indicator": "QOL_01",
                "flag": "Vocal fatigue with reduced prosodic range — recommend wellbeing check-in",
                "severity": level,
            })

        if qi_links:
            flags.append({
                "resident_id": resident_id,
                "display_name": name,
                "alert_level": level,
                "analysis_id": alert.get("analysis_id"),
                "qi_flags": qi_links,
            })

    return {"flags": flags, "total_flagged_residents": len(flags)}


# ---------------------------------------------------------------------------
# Report HTML builder
# ---------------------------------------------------------------------------


def _build_report_html(
    display_name: str,
    resident_id: str,
    latest: dict,
    all_analyses: list[dict],
) -> str:
    """Build a printable HTML clinical risk report."""
    features = latest.get("acoustic_features", {})
    risk = latest.get("risk_scores", {})
    narrative = latest.get("narrative_report", "")
    alert_level = latest.get("alert_level", "green")
    confidence = latest.get("confidence", "low")
    created = latest.get("created_at", "")[:19].replace("T", " ")

    alert_color = {"green": "#22c55e", "amber": "#f59e0b", "red": "#ef4444"}.get(alert_level, "#6b7280")

    rows = ""
    for key in ["duration_s", "speech_duration_s", "pause_duration_s", "pause_count",
                 "mean_pause_duration_s", "speech_rate_proxy", "mean_energy", "energy_std",
                 "vocal_fatigue_index", "pitch_mean_hz", "pitch_std_hz", "jitter_pct",
                 "shimmer_pct", "zcr_mean", "spectral_centroid_hz"]:
        val = features.get(key)
        if val is not None:
            label = key.replace("_", " ").title()
            rows += f"<tr><td style='padding:4px 12px;border-bottom:1px solid #e5e7eb'>{label}</td>"
            rows += f"<td style='padding:4px 12px;border-bottom:1px solid #e5e7eb;font-weight:600'>{val}</td></tr>"

    risk_rows = ""
    for key in ["speech_rate_change_pct", "pause_duration_change_pct", "energy_change_pct", "overall_deviation_pct"]:
        val = risk.get(key)
        if val is not None:
            label = key.replace("_", " ").title()
            risk_rows += f"<tr><td style='padding:4px 12px;border-bottom:1px solid #e5e7eb'>{label}</td>"
            risk_rows += f"<td style='padding:4px 12px;border-bottom:1px solid #e5e7eb;font-weight:600'>{val:+.1f}%</td></tr>"

    # Transcript if available
    transcript = latest.get("transcript", "")
    transcript_section = ""
    if transcript:
        transcript_section = f"""
        <h3 style="margin-top:20px">Transcript</h3>
        <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-style:italic">{transcript}</p>
        """

    # Trend mini-table
    trend_rows = ""
    for i, a in enumerate(all_analyses[:5]):
        af = a.get("acoustic_features", {})
        rs = a.get("risk_scores", {})
        trend_rows += f"""<tr>
            <td style='padding:4px 8px;border-bottom:1px solid #e5e7eb'>{a.get('created_at','')[:10]}</td>
            <td style='padding:4px 8px;border-bottom:1px solid #e5e7eb'>{af.get('speech_rate_proxy','—')}</td>
            <td style='padding:4px 8px;border-bottom:1px solid #e5e7eb'>{af.get('mean_pause_duration_s','—')}</td>
            <td style='padding:4px 8px;border-bottom:1px solid #e5e7eb'>{rs.get('overall_deviation_pct','—')}</td>
            <td style='padding:4px 8px;border-bottom:1px solid #e5e7eb'>
                <span style='color:{{"green":"#22c55e","amber":"#f59e0b","red":"#ef4444"}}.get(a.get("alert_level","green"),"#6b7280")'>{a.get('alert_level','—')}</span>
            </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Voice Biomarker Report — {display_name}</title>
<style>body{{font-family:'Inter',system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#111}}
h1{{color:#111;border-bottom:3px solid #ff7b00;padding-bottom:8px}}
h2{{color:#374151;margin-top:24px}}
table{{border-collapse:collapse;width:100%}}th{{text-align:left;padding:6px 12px;background:#f3f4f6;border-bottom:2px solid #d1d5db}}
.badge{{display:inline-block;padding:4px 14px;border-radius:20px;color:#fff;font-weight:600;font-size:14px}}
@media print{{body{{padding:20px}}}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center">
    <h1>Voice Biomarker Risk Report</h1>
    <img src="/favicon.ico" width="32" height="32" alt="CareData" />
</div>
<p style="color:#6b7280">Generated: {created} · Confidence: {confidence}</p>

<table style="margin-bottom:20px"><tr>
    <td><strong>Resident:</strong> {display_name}</td>
    <td><strong>ID:</strong> {resident_id}</td>
    <td><strong>Alert Level:</strong> <span class="badge" style="background:{alert_color}">{alert_level.upper()}</span></td>
</tr></table>

<h2>Clinical Narrative</h2>
<p style="background:#fffbeb;border-left:4px solid #ff7b00;padding:12px 16px;border-radius:4px">{narrative}</p>

{transcript_section}

<h2>Acoustic Features</h2>
<table>{rows}</table>

{"<h2>Baseline Deviation</h2><table>" + risk_rows + "</table>" if risk_rows else ""}

<h2>Recent Trend (Last 5 Recordings)</h2>
<table>
<tr><th>Date</th><th>Speech Rate</th><th>Mean Pause</th><th>Deviation %</th><th>Alert</th></tr>
{trend_rows}
</table>

<hr style="margin-top:30px;border:none;border-top:1px solid #e5e7eb">
<p style="font-size:12px;color:#9ca3af;text-align:center">
This is a trend monitoring tool, not a diagnostic device. Flagged voice changes
require clinical assessment by a qualified health professional.
<br>CareData Voice Biomarker Module · Confidential
</p>
</body></html>"""
