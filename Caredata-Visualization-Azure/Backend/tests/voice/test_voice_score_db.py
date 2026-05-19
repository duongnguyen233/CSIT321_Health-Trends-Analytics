"""Tests for voice_score_db — per-recording score persistence."""
from __future__ import annotations
import pytest

from app.services import voice_score_db


@pytest.fixture(autouse=True)
def _clear():
    voice_score_db._in_memory.clear()
    yield
    voice_score_db._in_memory.clear()


SUBSCORES = {
    "phonatory": 12.0,
    "articulatory": 8.5,
    "prosodic": 5.1,
    "respiratory": 3.0,
    "linguistic": 9.4,
}


def test_create_score_round_trip():
    voice_score_db.create_score(
        profile_id="P1",
        recording_id="R1",
        concern_score=18.7,
        subscores=SUBSCORES,
    )
    fetched = voice_score_db.get_score("P1", "R1")
    assert fetched is not None
    assert fetched["concern_score"] == 18.7
    assert fetched["subscores"]["phonatory"] == 12.0
    assert fetched["mahalanobis"] is None
    assert fetched["iforest"] is None


def test_create_score_with_optional_metrics():
    voice_score_db.create_score(
        profile_id="P1",
        recording_id="R1",
        concern_score=80.0,
        subscores=SUBSCORES,
        mahalanobis=15.2,
        iforest=0.7,
        feature_deltas={"jitter_local": 3.4, "shimmer_local": -2.1},
    )
    fetched = voice_score_db.get_score("P1", "R1")
    assert fetched["mahalanobis"] == 15.2
    assert fetched["iforest"] == 0.7
    assert fetched["feature_deltas"]["jitter_local"] == 3.4


def test_list_scores_orders_newest_first():
    import time
    voice_score_db.create_score(profile_id="P1", recording_id="R-old", concern_score=10.0, subscores=SUBSCORES)
    time.sleep(0.01)  # ensure created_at differs
    voice_score_db.create_score(profile_id="P1", recording_id="R-new", concern_score=20.0, subscores=SUBSCORES)

    items = voice_score_db.list_scores("P1", limit=10)
    assert len(items) == 2
    assert items[0]["recording_id"] == "R-new"
    assert items[1]["recording_id"] == "R-old"


def test_list_scores_limit_caps_returned_items():
    for i in range(5):
        voice_score_db.create_score(
            profile_id="P1", recording_id=f"R{i}", concern_score=float(i), subscores=SUBSCORES,
        )
    items = voice_score_db.list_scores("P1", limit=3)
    assert len(items) == 3


def test_list_scores_empty_for_unknown_profile():
    assert voice_score_db.list_scores("nope", limit=10) == []
