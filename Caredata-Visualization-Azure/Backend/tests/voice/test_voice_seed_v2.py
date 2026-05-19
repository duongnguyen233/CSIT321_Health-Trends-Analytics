"""Tests for the v2 voice biomarker seed."""
from __future__ import annotations
import pytest

from app.services import (
    voice_analysis_db,
    voice_features_db,
    voice_link_db,
    voice_profile_db,
    voice_recording_db,
    voice_score_db,
)
from app.services.voice_seed_v2 import (
    BASELINE_COUNT,
    DEMO_RESIDENTS,
    DRIFT_COUNT,
    seed_v2_demo_data,
)


@pytest.fixture(autouse=True)
def _clear():
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_score_db._in_memory.clear()
    voice_features_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()
    yield
    voice_link_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_recording_db._in_memory.clear()
    voice_score_db._in_memory.clear()
    voice_features_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()


def test_seed_creates_four_residents():
    seed_v2_demo_data()
    for demo in DEMO_RESIDENTS:
        p = voice_profile_db.get_by_resident_id(demo["resident_id"])
        assert p is not None, demo["resident_id"]


def test_seed_is_idempotent():
    seed_v2_demo_data()
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V001")
    items = voice_recording_db.list_recordings(p["profile_id"])
    assert len(items) == BASELINE_COUNT


def test_drift_resident_has_baseline_plus_drift_recordings():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V004")
    items = voice_recording_db.list_recordings(p["profile_id"])
    assert len(items) == BASELINE_COUNT + DRIFT_COUNT


def test_baseline_residents_have_zero_concern_scores():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V001")
    scores = voice_score_db.list_scores(p["profile_id"], limit=BASELINE_COUNT)
    assert all(s["concern_score"] == 0.0 for s in scores)


def test_drift_resident_has_elevated_concern_scores():
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V004")
    scores = voice_score_db.list_scores(p["profile_id"], limit=DRIFT_COUNT + BASELINE_COUNT)
    elevated = [s for s in scores if s["concern_score"] >= 70.0]
    assert len(elevated) == DRIFT_COUNT


def test_drift_resident_has_review_alert():
    """The seed runs evaluate_alerts on the drift resident; at least one
    review alert should be persisted."""
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V004")
    alerts = voice_analysis_db.list_dim_alerts(profile_id=p["profile_id"])
    review = [a for a in alerts if a["severity"] == "review"]
    assert len(review) >= 1


def test_seed_persists_features_for_lock_baseline():
    """Each recording has a corresponding features row so lock-baseline can
    fit a real PCA bundle off the seed data."""
    seed_v2_demo_data()
    p = voice_profile_db.get_by_resident_id("R-V001")
    features = voice_features_db.list_features(p["profile_id"])
    assert len(features) == BASELINE_COUNT


def test_seed_creates_open_link_per_resident():
    seed_v2_demo_data()
    all_links = voice_link_db.list_all()
    for demo in DEMO_RESIDENTS:
        matches = [l for l in all_links if l.get("resident_id") == demo["resident_id"]]
        assert matches, demo["resident_id"]
