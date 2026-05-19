"""Pydantic schema tests for the redesigned voice biomarker upload contract."""
from __future__ import annotations
import pytest
from pydantic import ValidationError

from app.api.voice_schemas import (
    StageOffsets,
    ContextFlags,
    ClientMeta,
    LinkMetadata,
    UploadResponse,
    REQUIRED_STAGES,
)


VALID_STAGE_OFFSETS = {
    "sustained_a": [0.0, 6.2],
    "ddk": [6.2, 11.4],
    "reading": [11.4, 18.0],
    "open_prompt": [18.0, 52.5],
}

VALID_CLIENT_META = {
    "ua": "Mozilla/5.0 ...",
    "sample_rate": 48000,
    "channels": 1,
    "echo_cancellation": True,
    "noise_suppression": False,
    "auto_gain_control": False,
}


def test_stage_offsets_requires_all_four_stages():
    payload = {"sustained_a": [0, 5], "ddk": [5, 10]}
    with pytest.raises(ValidationError):
        StageOffsets.model_validate(payload)


def test_stage_offsets_accepts_valid_payload():
    s = StageOffsets.model_validate(VALID_STAGE_OFFSETS)
    assert s.sustained_a == (0.0, 6.2)
    assert s.open_prompt == (18.0, 52.5)


def test_stage_offsets_rejects_decreasing_range():
    bad = dict(VALID_STAGE_OFFSETS)
    bad["sustained_a"] = [5.0, 1.0]
    with pytest.raises(ValidationError):
        StageOffsets.model_validate(bad)


def test_stage_offsets_rejects_negative_start():
    bad = dict(VALID_STAGE_OFFSETS)
    bad["sustained_a"] = [-1.0, 5.0]
    with pytest.raises(ValidationError):
        StageOffsets.model_validate(bad)


def test_required_stages_constant_matches_schema_fields():
    """If REQUIRED_STAGES drifts from schema fields, downstream code breaks silently."""
    assert REQUIRED_STAGES == ("sustained_a", "ddk", "reading", "open_prompt")


def test_context_flags_default_all_false():
    f = ContextFlags()
    assert f.cold is False
    assert f.dentures_out is False
    assert f.just_woke_up is False
    assert f.pain is False


def test_context_flags_round_trip_truthy():
    f = ContextFlags.model_validate({"cold": True, "pain": True})
    assert f.cold is True
    assert f.pain is True
    assert f.dentures_out is False


def test_client_meta_rejects_noise_suppression_true():
    bad = dict(VALID_CLIENT_META)
    bad["noise_suppression"] = True
    with pytest.raises(ValidationError):
        ClientMeta.model_validate(bad)


def test_client_meta_rejects_auto_gain_control_true():
    bad = dict(VALID_CLIENT_META)
    bad["auto_gain_control"] = True
    with pytest.raises(ValidationError):
        ClientMeta.model_validate(bad)


def test_client_meta_accepts_valid_payload():
    m = ClientMeta.model_validate(VALID_CLIENT_META)
    assert m.sample_rate == 48000
    assert m.echo_cancellation is True


def test_link_metadata_minimal_construction():
    m = LinkMetadata(
        resident_display_name="R",
        valid_for_date="2026-05-06",
        stages=[{"id": "sustained_a", "type": "sustained", "text": "..."}],
    )
    assert m.language == "en-AU"
    assert m.script_version == "v1"


def test_upload_response_minimal_construction():
    r = UploadResponse(recording_id="abc", status="queued")
    assert r.snr_db is None
