"""Tests for the dimension-tagged alert API in voice_analysis_db."""
from __future__ import annotations
import pytest

from app.services import voice_analysis_db


@pytest.fixture(autouse=True)
def _clear():
    voice_analysis_db._dim_alerts_in_memory.clear()
    yield
    voice_analysis_db._dim_alerts_in_memory.clear()


def test_create_dim_alert_round_trips():
    a = voice_analysis_db.create_dim_alert(
        profile_id="P1",
        resident_id="R1",
        recording_id="rec-1",
        severity="watch",
        dimension="phonatory",
        summary="Voice quality (phonatory) has been unusual for 2 of the last 3 recordings.",
    )
    assert a["alert_id"]
    assert a["severity"] == "watch"
    assert a["dimension"] == "phonatory"
    assert a["ack_at"] is None


def test_create_dim_alert_rejects_unknown_severity():
    with pytest.raises(ValueError):
        voice_analysis_db.create_dim_alert(
            profile_id="P1", resident_id="R1", recording_id="r",
            severity="critical",  # not in VALID_SEVERITIES
            dimension="phonatory", summary="x",
        )


def test_create_dim_alert_rejects_unknown_dimension():
    with pytest.raises(ValueError):
        voice_analysis_db.create_dim_alert(
            profile_id="P1", resident_id="R1", recording_id="r",
            severity="watch",
            dimension="motor",  # not in VALID_DIMENSIONS
            summary="x",
        )


def test_list_dim_alerts_filters_to_open_by_default():
    a = voice_analysis_db.create_dim_alert(
        profile_id="P1", resident_id="R1", recording_id="r1",
        severity="watch", dimension="phonatory", summary="..",
    )
    voice_analysis_db.create_dim_alert(
        profile_id="P1", resident_id="R1", recording_id="r2",
        severity="review", dimension="prosodic", summary="..",
    )
    voice_analysis_db.ack_dim_alert(profile_id="P1", alert_id=a["alert_id"], ack_by="N1")

    open_only = voice_analysis_db.list_dim_alerts(profile_id="P1")
    assert len(open_only) == 1
    assert open_only[0]["recording_id"] == "r2"

    everything = voice_analysis_db.list_dim_alerts(profile_id="P1", open_only=False)
    assert len(everything) == 2


def test_list_dim_alerts_across_all_profiles():
    voice_analysis_db.create_dim_alert(
        profile_id="P1", resident_id="R1", recording_id="r1",
        severity="watch", dimension="phonatory", summary="..",
    )
    voice_analysis_db.create_dim_alert(
        profile_id="P2", resident_id="R2", recording_id="r2",
        severity="review", dimension="linguistic", summary="..",
    )
    items = voice_analysis_db.list_dim_alerts()
    assert len(items) == 2
    assert {a["profile_id"] for a in items} == {"P1", "P2"}


def test_ack_dim_alert_sets_ack_fields():
    a = voice_analysis_db.create_dim_alert(
        profile_id="P1", resident_id="R1", recording_id="r1",
        severity="watch", dimension="phonatory", summary="..",
    )
    assert voice_analysis_db.ack_dim_alert(
        profile_id="P1", alert_id=a["alert_id"], ack_by="nurse-1",
    ) is True
    items = voice_analysis_db.list_dim_alerts(profile_id="P1", open_only=False)
    assert items[0]["ack_by"] == "nurse-1"
    assert items[0]["ack_at"] is not None
