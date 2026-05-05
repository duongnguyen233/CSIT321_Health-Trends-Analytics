"""Voice biomarker v2 API — the redesigned router (Phase 1 of the rebuild).

Mounted at `/api/voice/v2/`. Coexists with the legacy `/api/voice/...` router
during the cutover; the legacy router will be removed in Phase 2.

Endpoints:
- GET  /api/voice/v2/r/{token}                       — link metadata (public)
- POST /api/voice/v2/upload                          — multipart upload (public)
- POST /api/voice/v2/n/residents/{id}/issue-link     — nurse-only, idempotent
- POST /api/voice/v2/n/residents/{id}/lock-baseline  — nurse-only (Phase 1 stub)
- GET  /api/voice/v2/n/residents/{id}/scores         — nurse-only
- GET  /api/voice/v2/n/alerts                        — nurse-only
- POST /api/voice/v2/n/alerts/{alert_id}/ack         — nurse-only

The framing rule (no disease names) is enforced repo-wide by
`tests/voice/test_framing.py` — every string in this file has been chosen
to describe voice dimensions, never neurological labels.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import ValidationError

from app.api.voice_prompts import get_script
from app.api.voice_schemas import (
    ClientMeta,
    ContextFlags,
    LinkMetadata,
    StageOffsets,
    UploadResponse,
)
from app.core.config import settings
from app.services import (
    voice_analysis_db,
    voice_audio_blob,
    voice_baseline,
    voice_features_db,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
)
from app.services.jwt_auth import get_current_user
from app.services.voice_alerts import evaluate_alerts
from app.services.voice_processor_v2 import LowSnrError, extract_all
from app.services.voice_score import score_recording


router = APIRouter(prefix="/api/voice/v2", tags=["Voice Biomarker v2"])
logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _link_is_expired(link: dict) -> bool:
    expires_at = link.get("expires_at") or ""
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    return datetime.now(timezone.utc) > exp


def _validation_400(prefix: str, errors):
    raise HTTPException(
        status_code=400,
        detail={"code": "VALIDATION", "where": prefix, "errors": list(errors)},
    )


# ---------------------------------------------------------------------------
# Public — link metadata
# ---------------------------------------------------------------------------


@router.get("/r/{token}", response_model=LinkMetadata)
def get_link_metadata(token: str):
    link = voice_link_db.get_link(token)
    if link is None:
        raise HTTPException(404, "link not found")
    if link.get("used"):
        raise HTTPException(410, "link already used")
    if _link_is_expired(link):
        raise HTTPException(410, "link expired")
    profile = voice_profile_db.get_by_resident_id(link["resident_id"])
    display_name = profile.get("display_name") if profile else link["resident_id"]
    script = get_script("v1")
    return LinkMetadata(
        resident_display_name=display_name,
        language=script["language"],
        script_version=script["version"],
        valid_for_date=link.get("valid_for_date") or date.today().isoformat(),
        stages=script["stages"],
    )


# ---------------------------------------------------------------------------
# Public — upload
# ---------------------------------------------------------------------------


@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload(
    background_tasks: BackgroundTasks,
    token: str = Form(...),
    audio: UploadFile = File(...),
    stage_offsets: str = Form(...),
    context_flags: str = Form(...),
    client_meta: str = Form(...),
):
    # 1. Token + state checks
    link = voice_link_db.get_link(token)
    if link is None:
        raise HTTPException(404, "link not found")
    if link.get("used") or _link_is_expired(link):
        raise HTTPException(410, "link unavailable")

    # 2. Parse + validate JSON form fields. `client_meta` enforces the
    #    noise-suppression / auto-gain-control hard rule.
    try:
        offsets = StageOffsets.model_validate_json(stage_offsets)
    except ValidationError as e:
        _validation_400("stage_offsets", e.errors())
    try:
        flags = ContextFlags.model_validate_json(context_flags)
    except ValidationError as e:
        _validation_400("context_flags", e.errors())
    try:
        meta = ClientMeta.model_validate_json(client_meta)
    except ValidationError as e:
        # Detect AGC / NS violations for a clearer code.
        for err in e.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()))
            if loc in ("noise_suppression", "auto_gain_control"):
                raise HTTPException(
                    status_code=400,
                    detail={"code": "AUDIO_CONSTRAINTS_VIOLATED", "field": loc},
                )
        _validation_400("client_meta", e.errors())

    # 3. Resident profile must exist
    profile = voice_profile_db.get_by_resident_id(link["resident_id"])
    if profile is None:
        raise HTTPException(404, "resident profile not found")

    # 4. Read audio (5 MB cap)
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "file too large")

    # 5. Upload to blob, insert recording row, mark link used
    recording_id = str(uuid.uuid4())
    blob_uri = voice_audio_blob.upload_audio(
        link["resident_id"], recording_id, audio_bytes,
        content_type=audio.content_type or "audio/webm",
    )
    voice_recording_db.create_recording(
        profile_id=profile["profile_id"],
        recording_id=recording_id,
        duration_s=0.0,  # populated by background task once features extracted
        prompt_id="v1",
        audio_blob_uri=blob_uri,
        stage_offsets=offsets.model_dump(),
        context_flags=flags.model_dump(),
        client_meta=meta.model_dump(),
    )
    voice_link_db.mark_used(token)

    # 6. Enqueue background processing. Phase 1 leaves the heavy pipeline as a
    #    placeholder — the recording status flips to 'done' with the existing
    #    pure-Python feature extractor in the legacy code path. Phase 2
    #    replaces _process_recording_v2 with the real pipeline.
    background_tasks.add_task(
        _process_recording_v2,
        recording_id=recording_id,
        profile_id=profile["profile_id"],
    )

    return UploadResponse(recording_id=recording_id, status="queued")


# ---------------------------------------------------------------------------
# Background processor — Phase 1 placeholder
# ---------------------------------------------------------------------------


def _evaluate_and_persist_alerts(
    *,
    profile_id: str,
    resident_id: str,
    recording_id: str,
    today_score: dict,
    today_context_flags: dict,
) -> None:
    """Pull recent history, evaluate alert rules, persist any non-suppressed alerts."""
    history_scores = voice_score_db.list_scores(profile_id, limit=4)
    # The latest score in list_scores is *this* recording (just inserted) —
    # filter it out so `history` is strictly prior recordings.
    history = [s for s in history_scores if s.get("recording_id") != recording_id][:3]

    history_flags: list[dict] = []
    for s in history:
        rec = voice_recording_db.get_recording(profile_id, s.get("recording_id") or "")
        history_flags.append((rec or {}).get("context_flags") or {})

    candidates = evaluate_alerts(
        today_score=today_score,
        history=history,
        today_context_flags=today_context_flags,
        history_context_flags=history_flags,
    )
    for cand in candidates:
        if cand.suppressed:
            logger.info(
                "alert suppressed profile_id=%s severity=%s dimension=%s reason=%s",
                profile_id, cand.severity, cand.dimension, cand.suppression_reason,
            )
            continue
        voice_analysis_db.create_dim_alert(
            profile_id=profile_id,
            resident_id=resident_id,
            recording_id=recording_id,
            severity=cand.severity,
            dimension=cand.dimension,
            summary=cand.summary,
        )
        logger.info(
            "alert created profile_id=%s severity=%s dimension=%s",
            profile_id, cand.severity, cand.dimension,
        )


def _process_recording_v2(recording_id: str, profile_id: str) -> None:
    """Phase 2 pipeline runner.

    1. Mark processing.
    2. Pull audio bytes back from blob.
    3. Run voice_processor_v2.extract_all (raises LowSnrError to fail-fast).
    4. Persist Features row.
    5. Stamp SNR onto Recording, mark status=done.

    Phase 3 will plug scoring + alert generation in here.
    """
    try:
        voice_recording_db.update_status(profile_id, recording_id, "processing")
        rec = voice_recording_db.get_recording(profile_id, recording_id)
        if rec is None:
            logger.warning("recording vanished mid-process recording_id=%s", recording_id)
            return

        blob_uri = rec.get("audio_blob_uri") or ""
        audio_bytes = voice_audio_blob.download_audio(blob_uri) if blob_uri else None
        if not audio_bytes:
            logger.warning(
                "audio bytes unavailable; marking failed recording_id=%s", recording_id
            )
            voice_recording_db.update_status(profile_id, recording_id, "failed")
            return

        stage_offsets = rec.get("stage_offsets") or {}

        try:
            features = extract_all(audio_bytes, stage_offsets)
        except LowSnrError as e:
            logger.info(
                "low SNR rejected recording_id=%s snr=%.2f", recording_id, e.snr_db
            )
            voice_recording_db.set_quality_metrics(
                profile_id, recording_id, snr_db=e.snr_db
            )
            voice_recording_db.update_status(profile_id, recording_id, "failed")
            # Phase 3 may want to surface this to the nurse dashboard via a
            # context_flag-style annotation; today we just record the SNR.
            return

        voice_features_db.create_features(
            profile_id=profile_id,
            recording_id=recording_id,
            features=features,
        )
        voice_recording_db.set_quality_metrics(
            profile_id, recording_id, snr_db=features.get("snr_db"),
        )

        # Score against baseline if locked. Without a baseline we still
        # write a placeholder Score row with concern_score=0 so the
        # time-series charts on the dashboard have continuity.
        profile = voice_profile_db.get_by_id(profile_id) or {}
        baseline_uri = profile.get("baseline_blob_uri")
        if baseline_uri:
            try:
                from app.services import voice_baseline

                baseline = voice_baseline.load_baseline(baseline_uri)
                if baseline is not None:
                    score = score_recording(features, baseline)
                    voice_score_db.create_score(
                        profile_id=profile_id,
                        recording_id=recording_id,
                        concern_score=score["concern_score"],
                        subscores=score["subscores"],
                        mahalanobis=score["mahalanobis"],
                        iforest=score["iforest"],
                        feature_deltas=score["feature_deltas"],
                    )
                    _evaluate_and_persist_alerts(
                        profile_id=profile_id,
                        resident_id=profile.get("resident_id") or "",
                        recording_id=recording_id,
                        today_score=score | {"recording_id": recording_id},
                        today_context_flags=rec.get("context_flags") or {},
                    )
                else:
                    logger.warning(
                        "baseline_blob_uri present but load failed profile_id=%s",
                        profile_id,
                    )
            except Exception:
                logger.exception(
                    "scoring failed recording_id=%s profile_id=%s",
                    recording_id, profile_id,
                )
        else:
            # Pre-baseline enrolment recording — placeholder zero score
            voice_score_db.create_score(
                profile_id=profile_id,
                recording_id=recording_id,
                concern_score=0.0,
                subscores={
                    "phonatory": 0.0, "articulatory": 0.0, "prosodic": 0.0,
                    "respiratory": 0.0, "linguistic": 0.0,
                },
            )

        voice_recording_db.update_status(profile_id, recording_id, "done")
        logger.info(
            "v2 pipeline done recording_id=%s profile_id=%s snr=%.2f",
            recording_id, profile_id, features.get("snr_db", 0.0),
        )
    except Exception:  # pragma: no cover - belt-and-braces
        logger.exception(
            "v2 pipeline crashed recording_id=%s profile_id=%s",
            recording_id, profile_id,
        )
        voice_recording_db.update_status(profile_id, recording_id, "failed")


# ---------------------------------------------------------------------------
# Nurse — issue link
# ---------------------------------------------------------------------------


@router.post("/n/residents/{resident_id}/issue-link")
def issue_link(
    resident_id: str,
    date_param: str = Query(..., alias="date", description="ISO date YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    # Idempotent per (resident_id, date)
    existing = voice_link_db.get_link_by_resident_and_date(resident_id, date_param)
    if existing is not None and not existing.get("used") and not _link_is_expired(existing):
        return {
            "token": existing["token"],
            "url": _link_url(existing["token"]),
            "resident_id": resident_id,
            "valid_for_date": date_param,
            "expires_at": existing["expires_at"],
        }

    # Otherwise create a fresh one. Expires at end of day + 24h grace.
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=36)).isoformat()
    link = voice_link_db.create_link(
        resident_id=resident_id,
        facility_id="default",
        generated_by=current_user.get("sub", ""),
        expires_at=expires_at,
        valid_for_date=date_param,
    )
    return {
        "token": link["token"],
        "url": _link_url(link["token"]),
        "resident_id": resident_id,
        "valid_for_date": date_param,
        "expires_at": expires_at,
    }


def _link_url(token: str) -> str:
    base = getattr(settings, "VOICE_LINK_BASE_URL", "http://localhost:5173")
    return f"{base}/voice/record/{token}"


# ---------------------------------------------------------------------------
# Nurse — lock-baseline (Phase 1 stub)
# ---------------------------------------------------------------------------

BASELINE_RECORDINGS_REQUIRED = 10


@router.post("/n/residents/{resident_id}/lock-baseline")
def lock_baseline(
    resident_id: str,
    current_user: dict = Depends(get_current_user),
):
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if profile is None:
        raise HTTPException(404, "resident profile not found")

    # Use *features* (not just recordings) — only recordings that completed
    # the pipeline have feature dicts and can feed PCA/MCD/IF.
    feature_rows = voice_features_db.list_features(profile["profile_id"])
    have = len(feature_rows)
    if have < BASELINE_RECORDINGS_REQUIRED:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INSUFFICIENT_RECORDINGS",
                "have": have,
                "need": BASELINE_RECORDINGS_REQUIRED,
            },
        )

    # Take the oldest BASELINE_RECORDINGS_REQUIRED features so the lock is
    # deterministic regardless of when the nurse hits the button.
    enrolment = feature_rows[:BASELINE_RECORDINGS_REQUIRED]

    try:
        bundle = voice_baseline.fit_baseline(enrolment)
    except ValueError as e:
        raise HTTPException(409, {"code": "FIT_FAILED", "detail": str(e)})

    next_version = int(profile.get("baseline_version") or 0) + 1
    bundle["version"] = next_version
    blob_uri = voice_baseline.save_baseline(
        profile["profile_id"], next_version, bundle
    )

    locked_at = datetime.now(timezone.utc).isoformat()
    voice_profile_db.update_profile(profile["profile_id"], {
        "baseline_locked_at": locked_at,
        "baseline_version": next_version,
        "baseline_blob_uri": blob_uri,
        "baseline_blob_key": blob_uri,  # back-compat with the spec field name
    })

    logger.info(
        "baseline locked profile_id=%s version=%d uri=%s recordings=%d",
        profile["profile_id"], next_version, blob_uri, len(enrolment),
    )

    return {
        "baseline_locked": True,
        "version": next_version,
        "baseline_blob_uri": blob_uri,
        "locked_at": locked_at,
        "recordings_used": len(enrolment),
    }


# ---------------------------------------------------------------------------
# Nurse — scores time series
# ---------------------------------------------------------------------------


@router.get("/n/residents/{resident_id}/scores")
def get_scores(
    resident_id: str,
    days: int = Query(60, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if profile is None:
        raise HTTPException(404, "resident profile not found")
    scores = voice_score_db.list_scores(profile["profile_id"], limit=days)
    return {"resident_id": resident_id, "days": days, "scores": scores}


# ---------------------------------------------------------------------------
# Nurse — dimension alerts
# ---------------------------------------------------------------------------


@router.get("/n/residents")
def list_residents_for_nurse(
    current_user: dict = Depends(get_current_user),
):
    """Return all voice profiles enriched with last-5 scores + latest alert.

    Drives the nurse dashboard list view.
    """
    profiles: list[dict] = []
    table = voice_profile_db._get_table()
    if table:
        try:
            entities = list(
                table.query_entities(query_filter="PartitionKey eq 'resident'")
            )
            profiles = [voice_profile_db._entity_to_dict(e) for e in entities]
        except Exception as ex:
            logger.warning("list_residents_for_nurse Tables fetch failed: %s", ex)
    else:
        profiles = [dict(p) for p in voice_profile_db._in_memory.values()]

    out = []
    for p in profiles:
        scores = voice_score_db.list_scores(p["profile_id"], limit=5)
        latest_alerts = voice_analysis_db.list_dim_alerts(
            profile_id=p["profile_id"], open_only=True,
        )
        latest_alert = latest_alerts[0] if latest_alerts else None
        latest_score = scores[0] if scores else None
        out.append({
            "profile_id": p["profile_id"],
            "resident_id": p.get("resident_id"),
            "display_name": p.get("display_name"),
            "baseline_locked_at": p.get("baseline_locked_at"),
            "baseline_version": p.get("baseline_version", 0),
            "last_recording_date": p.get("last_recording_date"),
            "latest_concern_score": (
                latest_score.get("concern_score") if latest_score else None
            ),
            "latest_subscores": (
                latest_score.get("subscores") if latest_score else None
            ),
            "scores_last_5": scores,
            "latest_alert": latest_alert,
        })
    return {"residents": out}


@router.get("/n/residents/{resident_id}/recordings/{recording_id}/audio")
def get_recording_audio_url(
    resident_id: str,
    recording_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a 5-minute presigned URL for the recording's audio blob.

    For in-memory blobs (dev fallback) we return a sentinel URL pointing at
    a streaming endpoint Phase 4 frontend can call directly. For real Azure
    blobs we hand back a SAS-signed URL.
    """
    profile = voice_profile_db.get_by_resident_id(resident_id)
    if profile is None:
        raise HTTPException(404, "resident profile not found")
    rec = voice_recording_db.get_recording(profile["profile_id"], recording_id)
    if rec is None:
        raise HTTPException(404, "recording not found")
    blob_uri = rec.get("audio_blob_uri") or ""
    if not blob_uri:
        raise HTTPException(404, "audio not available")
    presigned = voice_audio_blob.presigned_audio_url(blob_uri, minutes=5)
    if presigned is not None:
        return {"url": presigned, "kind": "presigned", "expires_in_s": 300}
    # In-memory fallback: tell caller to fetch via the streaming endpoint
    return {
        "url": f"/api/voice/v2/n/residents/{resident_id}/recordings/{recording_id}/stream",
        "kind": "stream",
        "expires_in_s": None,
    }


@router.get("/n/residents/{resident_id}/recordings/{recording_id}/stream")
def stream_recording_audio(
    resident_id: str,
    recording_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Stream audio bytes directly. Used when Azure presigned URLs aren't available
    (dev / in-memory fallback). The presigned-URL endpoint redirects here
    transparently for those cases."""
    from fastapi.responses import StreamingResponse
    import io as _io

    profile = voice_profile_db.get_by_resident_id(resident_id)
    if profile is None:
        raise HTTPException(404, "resident profile not found")
    rec = voice_recording_db.get_recording(profile["profile_id"], recording_id)
    if rec is None:
        raise HTTPException(404, "recording not found")
    audio = voice_audio_blob.download_audio(rec.get("audio_blob_uri") or "")
    if not audio:
        raise HTTPException(404, "audio not available")
    return StreamingResponse(_io.BytesIO(audio), media_type="audio/webm")


@router.get("/n/alerts")
def list_alerts(
    status: str = Query("open", pattern="^(open|all)$"),
    limit: int = Query(50, ge=1, le=500),
    cursor: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Paginated list of dimension alerts.

    `cursor` is a 0-indexed offset; `limit` caps the page size.
    """
    open_only = status == "open"
    all_alerts = voice_analysis_db.list_dim_alerts(open_only=open_only)
    page = all_alerts[cursor:cursor + limit]
    next_cursor = cursor + limit if cursor + limit < len(all_alerts) else None
    return {
        "status": status,
        "alerts": page,
        "next_cursor": next_cursor,
        "total": len(all_alerts),
    }


@router.post("/n/alerts/{alert_id}/ack")
def ack_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
):
    # Search across all profiles for the alert (cheap in-memory; in Tables we
    # could index by alert_id but Phase 1's volume doesn't justify it).
    all_alerts = voice_analysis_db.list_dim_alerts(open_only=False)
    target = next((a for a in all_alerts if a["alert_id"] == alert_id), None)
    if target is None:
        raise HTTPException(404, "alert not found")
    ok = voice_analysis_db.ack_dim_alert(
        profile_id=target["profile_id"],
        alert_id=alert_id,
        ack_by=current_user.get("sub", ""),
    )
    if not ok:
        raise HTTPException(500, "ack failed")
    return {"acknowledged": True, "alert_id": alert_id}
