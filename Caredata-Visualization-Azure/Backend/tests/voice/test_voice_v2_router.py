"""Smoke tests for the v2 voice biomarker router.

Phase 1 contract:
- GET  /api/voice/v2/r/{token}                           — link metadata (public)
- POST /api/voice/v2/upload                              — multipart upload
- POST /api/voice/v2/n/residents/{id}/issue-link         — nurse, idempotent per date
- POST /api/voice/v2/n/residents/{id}/lock-baseline      — Phase 1 stub returns 409
- GET  /api/voice/v2/n/residents/{id}/scores             — placeholder time series
- GET  /api/voice/v2/n/alerts?status=open                — list dim-alerts
- POST /api/voice/v2/n/alerts/{id}/ack                   — ack a dim-alert
"""
from __future__ import annotations

import io
import json
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import (
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
    voice_analysis_db,
    voice_audio_blob,
)
from app.services.jwt_auth import create_access_token


@pytest.fixture(autouse=True)
def _clear_state():
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_recording_db._in_memory_audio.clear()
    voice_score_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()
    voice_audio_blob._in_memory.clear()
    yield
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_recording_db._in_memory_audio.clear()
    voice_score_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()
    voice_audio_blob._in_memory.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def nurse_token() -> str:
    return create_access_token({"sub": "nurse-1", "email": "n@t", "role": "nurse"})


@pytest.fixture
def seeded_resident() -> dict:
    """Create a profile + a fresh, unused, unexpired link for the resident."""
    profile = voice_profile_db.create_profile(
        resident_id="R1",
        facility_id="F1",
        display_name="Margaret Test",
        password_hash="hash",
    )
    return profile


def _make_link(resident_id: str = "R1", *, used: bool = False, expired: bool = False) -> dict:
    expires = datetime.now(timezone.utc) + (
        timedelta(days=-1) if expired else timedelta(days=1)
    )
    link = voice_link_db.create_link(
        resident_id=resident_id,
        facility_id="F1",
        generated_by="nurse-1",
        expires_at=expires.isoformat(),
        valid_for_date=date.today().isoformat(),
    )
    if used:
        voice_link_db.mark_used(link["token"])
    return link


VALID_OFFSETS = {
    "sustained_a": [0.0, 6.0],
    "ddk": [6.0, 11.0],
    "reading": [11.0, 18.0],
    "open_prompt": [18.0, 50.0],
}
VALID_FLAGS = {"cold": False, "dentures_out": False, "just_woke_up": False, "pain": False}
VALID_META = {
    "ua": "TestClient/1.0",
    "sample_rate": 48000,
    "channels": 1,
    "echo_cancellation": True,
    "noise_suppression": False,
    "auto_gain_control": False,
}


# ---------------------------------------------------------------------------
# GET /r/{token}
# ---------------------------------------------------------------------------


def test_get_link_metadata_returns_script(seeded_resident, client):
    link = _make_link()
    r = client.get(f"/api/voice/v2/r/{link['token']}")
    assert r.status_code == 200
    body = r.json()
    assert body["resident_display_name"] == "Margaret Test"
    assert body["script_version"] == "v1"
    assert len(body["stages"]) == 4


def test_get_link_metadata_410_for_used_link(seeded_resident, client):
    link = _make_link(used=True)
    r = client.get(f"/api/voice/v2/r/{link['token']}")
    assert r.status_code == 410


def test_get_link_metadata_410_for_expired_link(seeded_resident, client):
    link = _make_link(expired=True)
    r = client.get(f"/api/voice/v2/r/{link['token']}")
    assert r.status_code == 410


# ---------------------------------------------------------------------------
# POST /upload
# ---------------------------------------------------------------------------


def _upload(client: TestClient, token: str, **overrides):
    files = {"audio": ("rec.webm", io.BytesIO(b"fake-audio-bytes"), "audio/webm")}
    data = {
        "token": token,
        "stage_offsets": json.dumps(overrides.get("stage_offsets", VALID_OFFSETS)),
        "context_flags": json.dumps(overrides.get("context_flags", VALID_FLAGS)),
        "client_meta": json.dumps(overrides.get("client_meta", VALID_META)),
    }
    return client.post("/api/voice/v2/upload", files=files, data=data)


def test_upload_happy_path_returns_202_and_persists(seeded_resident, client):
    link = _make_link()
    r = _upload(client, link["token"])
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["status"] == "queued"
    assert body["recording_id"]

    # blob present
    rec = voice_recording_db.get_recording(seeded_resident["profile_id"], body["recording_id"])
    assert rec is not None
    assert rec["audio_blob_uri"].startswith("memory://R1/")
    assert voice_audio_blob.download_audio(rec["audio_blob_uri"]) == b"fake-audio-bytes"

    # link consumed
    assert voice_link_db.get_link(link["token"])["used"] is True


def test_upload_rejects_reused_token(seeded_resident, client):
    link = _make_link(used=True)
    r = _upload(client, link["token"])
    assert r.status_code == 410


def test_upload_rejects_noise_suppression_true(seeded_resident, client):
    link = _make_link()
    bad_meta = dict(VALID_META, noise_suppression=True)
    r = _upload(client, link["token"], client_meta=bad_meta)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "AUDIO_CONSTRAINTS_VIOLATED"


def test_upload_rejects_auto_gain_control_true(seeded_resident, client):
    link = _make_link()
    bad_meta = dict(VALID_META, auto_gain_control=True)
    r = _upload(client, link["token"], client_meta=bad_meta)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "AUDIO_CONSTRAINTS_VIOLATED"


def test_upload_rejects_missing_stage(seeded_resident, client):
    link = _make_link()
    bad = {"sustained_a": [0, 6], "ddk": [6, 11]}  # missing reading + open_prompt
    r = _upload(client, link["token"], stage_offsets=bad)
    assert r.status_code == 400


def test_upload_404_when_resident_profile_missing(client):
    """Link points at a resident_id that has no voice profile."""
    link = voice_link_db.create_link(
        resident_id="ghost",
        facility_id="F1",
        generated_by="nurse-1",
        expires_at=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        valid_for_date=date.today().isoformat(),
    )
    r = _upload(client, link["token"])
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /n/residents/{id}/issue-link
# ---------------------------------------------------------------------------


def test_issue_link_requires_nurse_jwt(seeded_resident, client):
    r = client.post("/api/voice/v2/n/residents/R1/issue-link?date=2026-05-06")
    assert r.status_code == 401


def test_issue_link_returns_token_url_and_expiry(seeded_resident, client, nurse_token):
    r = client.post(
        "/api/voice/v2/n/residents/R1/issue-link?date=2026-05-06",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body
    assert body["valid_for_date"] == "2026-05-06"
    assert body["url"].endswith(body["token"])


def test_issue_link_is_idempotent_per_date(seeded_resident, client, nurse_token):
    r1 = client.post(
        "/api/voice/v2/n/residents/R1/issue-link?date=2026-05-06",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    r2 = client.post(
        "/api/voice/v2/n/residents/R1/issue-link?date=2026-05-06",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["token"] == r2.json()["token"]


# ---------------------------------------------------------------------------
# POST /n/residents/{id}/lock-baseline (Phase 1 stub)
# ---------------------------------------------------------------------------


def test_lock_baseline_phase1_stub_returns_insufficient_recordings(
    seeded_resident, client, nurse_token
):
    r = client.post(
        "/api/voice/v2/n/residents/R1/lock-baseline",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 409
    body = r.json()
    assert body["detail"]["code"] == "INSUFFICIENT_RECORDINGS"


# ---------------------------------------------------------------------------
# GET /n/residents/{id}/scores  (Phase 1 placeholder)
# ---------------------------------------------------------------------------


def test_scores_endpoint_returns_empty_list_when_none_stored(
    seeded_resident, client, nurse_token
):
    r = client.get(
        "/api/voice/v2/n/residents/R1/scores?days=60",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    assert r.json()["scores"] == []


def test_scores_endpoint_returns_persisted_scores(seeded_resident, client, nurse_token):
    voice_score_db.create_score(
        profile_id=seeded_resident["profile_id"],
        recording_id="rec-1",
        concern_score=42.0,
        subscores={"phonatory": 50, "articulatory": 0, "prosodic": 0, "respiratory": 0, "linguistic": 0},
    )
    r = client.get(
        "/api/voice/v2/n/residents/R1/scores?days=60",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["scores"]) == 1
    assert body["scores"][0]["concern_score"] == 42.0


# ---------------------------------------------------------------------------
# Alerts list + ack
# ---------------------------------------------------------------------------


def test_alerts_list_and_ack(seeded_resident, client, nurse_token):
    a = voice_analysis_db.create_dim_alert(
        profile_id=seeded_resident["profile_id"],
        resident_id="R1",
        recording_id="rec-1",
        severity="watch",
        dimension="phonatory",
        summary="Voice quality has been unusual for 2 of the last 3 recordings.",
    )
    r1 = client.get(
        "/api/voice/v2/n/alerts?status=open",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r1.status_code == 200
    assert len(r1.json()["alerts"]) == 1

    r2 = client.post(
        f"/api/voice/v2/n/alerts/{a['alert_id']}/ack",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r2.status_code == 200

    r3 = client.get(
        "/api/voice/v2/n/alerts?status=open",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r3.json()["alerts"] == []
