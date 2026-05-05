"""Tests for the v2 voice biomarker seed."""
from __future__ import annotations
import pytest

from app.services import (
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
)
from app.services.voice_seed_v2 import seed_v2_demo_data, DEMO_RESIDENTS


@pytest.fixture(autouse=True)
def _clear():
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_score_db._in_memory.clear()
    yield
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_score_db._in_memory.clear()


def test_seed_creates_four_residents():
    seed_v2_demo_data()
    for demo in DEMO_RESIDENTS:
        p = voice_profile_db.get_by_resident_id(demo["resident_id"])
        assert p is not None, demo["resident_id"]


def test_seed_is_idempotent():
    seed_v2_demo_data()
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V001")
    # 14 baseline recordings, no duplication
    items = voice_recording_db.list_recordings(p["profile_id"])
    assert len(items) == 14


def test_drift_resident_has_extra_recordings():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V004")
    items = voice_recording_db.list_recordings(p["profile_id"])
    assert len(items) == 17  # 14 baseline + 3 drift


def test_baseline_residents_have_zero_concern_scores():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V001")
    scores = voice_score_db.list_scores(p["profile_id"], limit=20)
    assert all(s["concern_score"] == 0.0 for s in scores)


def test_drift_resident_has_elevated_concern_scores():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V004")
    scores = voice_score_db.list_scores(p["profile_id"], limit=20)
    elevated = [s for s in scores if s["concern_score"] >= 40.0]
    assert len(elevated) == 3


def test_seed_creates_open_link_per_resident():
    seed_v2_demo_data()
    for demo in DEMO_RESIDENTS:
        # We can't easily query by resident, but we can check there's at least one link
        # for each by resident_id via the all-list
        all_links = voice_link_db.list_all()
        matches = [l for l in all_links if l.get("resident_id") == demo["resident_id"]]
        assert matches, demo["resident_id"]
