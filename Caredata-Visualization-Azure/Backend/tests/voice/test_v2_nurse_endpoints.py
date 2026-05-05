"""Tests for the Phase 3 nurse endpoint upgrades."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import (
    voice_analysis_db,
    voice_audio_blob,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
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
def client():
    return TestClient(app)


@pytest.fixture
def nurse_token():
    return create_access_token({"sub": "nurse-1", "email": "n@t", "role": "nurse"})


@pytest.fixture
def seeded():
    p = voice_profile_db.create_profile(
        resident_id="R1", facility_id="F1", display_name="Margaret", password_hash="x",
    )
    return p


# ---------------------------------------------------------------------------
# /n/residents
# ---------------------------------------------------------------------------


def test_list_residents_requires_nurse_jwt(seeded, client):
    r = client.get("/api/voice/v2/n/residents")
    assert r.status_code == 401


def test_list_residents_returns_profile_with_scores_and_alerts(
    seeded, client, nurse_token
):
    voice_score_db.create_score(
        profile_id=seeded["profile_id"], recording_id="rec1",
        concern_score=42.0,
        subscores={d: 0.0 for d in (
            "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
        )},
    )
    voice_analysis_db.create_dim_alert(
        profile_id=seeded["profile_id"], resident_id="R1",
        recording_id="rec1", severity="watch", dimension="phonatory",
        summary="Voice quality (phonatory) has been unusual.",
    )

    r = client.get(
        "/api/voice/v2/n/residents",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["residents"]) == 1
    res = body["residents"][0]
    assert res["resident_id"] == "R1"
    assert res["latest_concern_score"] == 42.0
    assert res["latest_alert"]["severity"] == "watch"
    assert len(res["scores_last_5"]) == 1


# ---------------------------------------------------------------------------
# /n/residents/{id}/recordings/{rid}/audio
# ---------------------------------------------------------------------------


def test_audio_url_returns_stream_for_in_memory_blob(
    seeded, client, nurse_token
):
    blob_uri = voice_audio_blob.upload_audio(
        seeded["resident_id"], "rec-A", b"fakebytes"
    )
    voice_recording_db.create_recording(
        profile_id=seeded["profile_id"], recording_id="rec-A",
        duration_s=10.0, prompt_id="v1",
        audio_blob_uri=blob_uri,
    )
    r = client.get(
        "/api/voice/v2/n/residents/R1/recordings/rec-A/audio",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "stream"
    assert "/stream" in body["url"]


def test_audio_stream_returns_bytes(seeded, client, nurse_token):
    blob_uri = voice_audio_blob.upload_audio(
        seeded["resident_id"], "rec-B", b"audio-bytes-here"
    )
    voice_recording_db.create_recording(
        profile_id=seeded["profile_id"], recording_id="rec-B",
        duration_s=10.0, prompt_id="v1",
        audio_blob_uri=blob_uri,
    )
    r = client.get(
        "/api/voice/v2/n/residents/R1/recordings/rec-B/stream",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    assert r.content == b"audio-bytes-here"


def test_audio_url_404_when_recording_missing(seeded, client, nurse_token):
    r = client.get(
        "/api/voice/v2/n/residents/R1/recordings/nope/audio",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /n/alerts pagination
# ---------------------------------------------------------------------------


def test_alerts_pagination_returns_page_and_cursor(seeded, client, nurse_token):
    for i in range(7):
        voice_analysis_db.create_dim_alert(
            profile_id=seeded["profile_id"], resident_id="R1",
            recording_id=f"rec-{i}", severity="watch", dimension="phonatory",
            summary="...",
        )
    r = client.get(
        "/api/voice/v2/n/alerts?status=open&limit=3&cursor=0",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["alerts"]) == 3
    assert body["total"] == 7
    assert body["next_cursor"] == 3

    r2 = client.get(
        f"/api/voice/v2/n/alerts?status=open&limit=3&cursor={body['next_cursor']}",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    body2 = r2.json()
    assert len(body2["alerts"]) == 3
    assert body2["next_cursor"] == 6
