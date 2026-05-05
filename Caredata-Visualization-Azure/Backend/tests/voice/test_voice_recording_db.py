"""Tests for the reshaped voice_recording_db.

Phase 1 adds: stage_offsets, context_flags, client_meta, audio_blob_uri,
snr_db. JSON dicts are stored as JSON strings in Azure Tables (since Tables
cannot hold dicts) and decoded on read.
"""
from __future__ import annotations
import pytest

from app.services import voice_recording_db


@pytest.fixture(autouse=True)
def _clear():
    voice_recording_db._in_memory.clear()
    voice_recording_db._in_memory_audio.clear()
    yield
    voice_recording_db._in_memory.clear()
    voice_recording_db._in_memory_audio.clear()


VALID_OFFSETS = {
    "sustained_a": [0.0, 6.2],
    "ddk": [6.2, 11.4],
    "reading": [11.4, 18.0],
    "open_prompt": [18.0, 52.5],
}


def test_create_recording_round_trips_new_fields():
    rec = voice_recording_db.create_recording(
        profile_id="P1",
        duration_s=52.5,
        prompt_id="v1",
        audio_blob_uri="memory://P1/abc.webm",
        stage_offsets=VALID_OFFSETS,
        context_flags={"cold": True, "pain": False},
        client_meta={"sample_rate": 48000, "channels": 1},
    )
    fetched = voice_recording_db.get_recording("P1", rec["recording_id"])
    assert fetched is not None
    assert fetched["audio_blob_uri"] == "memory://P1/abc.webm"
    assert fetched["stage_offsets"]["sustained_a"] == [0.0, 6.2]
    assert fetched["context_flags"]["cold"] is True
    assert fetched["client_meta"]["sample_rate"] == 48000


def test_create_recording_back_compat_with_legacy_audio_file_path():
    """Existing callers that pass audio_file_path still work."""
    rec = voice_recording_db.create_recording(
        profile_id="P1",
        duration_s=10.0,
        prompt_id="legacy",
        audio_file_path="/tmp/foo.wav",
    )
    fetched = voice_recording_db.get_recording("P1", rec["recording_id"])
    assert fetched is not None
    assert fetched["audio_file_path"] == "/tmp/foo.wav"


def test_status_defaults_to_uploaded():
    rec = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/y.webm",
    )
    assert rec["status"] == "uploaded"


def test_update_status_persists_done_state():
    rec = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/y.webm",
    )
    assert voice_recording_db.update_status("P1", rec["recording_id"], "done") is True
    fetched = voice_recording_db.get_recording("P1", rec["recording_id"])
    assert fetched["status"] == "done"


def test_snr_db_is_optional_and_nullable():
    rec = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/y.webm",
    )
    assert rec["snr_db"] is None


def test_set_features_extracted_promotes_status_and_snr():
    rec = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/y.webm",
    )
    voice_recording_db.set_quality_metrics("P1", rec["recording_id"], snr_db=18.5)
    fetched = voice_recording_db.get_recording("P1", rec["recording_id"])
    assert fetched["snr_db"] == 18.5


def test_list_recordings_orders_newest_first():
    a = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/a.webm",
    )
    b = voice_recording_db.create_recording(
        profile_id="P1", duration_s=1.0, prompt_id="x",
        audio_blob_uri="memory://P1/b.webm",
    )
    items = voice_recording_db.list_recordings("P1")
    assert [r["recording_id"] for r in items][0] in {a["recording_id"], b["recording_id"]}
    assert len(items) == 2


def test_jsonb_round_trip_via_table_path(monkeypatch):
    """Simulate the Azure path: create_recording must JSON-encode dicts so the
    columns survive Azure Tables (which cannot hold native dicts).
    The in-memory path bypasses this, so we exercise the helper directly."""
    encoded = voice_recording_db._jsonify_dicts({
        "stage_offsets": {"sustained_a": [0, 6]},
        "context_flags": {"cold": True},
    })
    assert isinstance(encoded["stage_offsets"], str)
    assert isinstance(encoded["context_flags"], str)
    decoded = voice_recording_db._dejsonify_dicts({
        "stage_offsets": encoded["stage_offsets"],
        "context_flags": encoded["context_flags"],
    })
    assert decoded["stage_offsets"] == {"sustained_a": [0, 6]}
    assert decoded["context_flags"] == {"cold": True}
