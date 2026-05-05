"""Tests for voice_link_db — focuses on the new per-date idempotency contract."""
from __future__ import annotations
import pytest

from app.services import voice_link_db


@pytest.fixture(autouse=True)
def _clear_in_memory():
    voice_link_db._in_memory.clear()
    yield
    voice_link_db._in_memory.clear()


def test_create_link_round_trips_with_valid_for_date():
    link = voice_link_db.create_link(
        resident_id="R1",
        facility_id="F1",
        generated_by="N1",
        expires_at="2026-05-07T00:00:00+00:00",
        valid_for_date="2026-05-06",
    )
    assert link["resident_id"] == "R1"
    assert link["valid_for_date"] == "2026-05-06"

    fetched = voice_link_db.get_link(link["token"])
    assert fetched is not None
    assert fetched["valid_for_date"] == "2026-05-06"


def test_create_link_defaults_valid_for_date_to_today_when_missing():
    """Backwards-compat: existing callers don't pass valid_for_date — default to today."""
    from datetime import date

    link = voice_link_db.create_link(
        resident_id="R1",
        facility_id="F1",
        generated_by="N1",
        expires_at="2026-05-07T00:00:00+00:00",
    )
    assert link["valid_for_date"] == date.today().isoformat()


def test_get_link_by_resident_and_date_idempotent_lookup():
    voice_link_db.create_link(
        resident_id="R1",
        facility_id="F1",
        generated_by="N1",
        expires_at="2026-05-07T00:00:00+00:00",
        valid_for_date="2026-05-06",
    )
    found = voice_link_db.get_link_by_resident_and_date("R1", "2026-05-06")
    assert found is not None
    assert found["resident_id"] == "R1"
    assert found["valid_for_date"] == "2026-05-06"


def test_get_link_by_resident_and_date_returns_none_when_no_match():
    voice_link_db.create_link(
        resident_id="R1", facility_id="F1", generated_by="N1",
        expires_at="2026-05-07T00:00:00+00:00", valid_for_date="2026-05-06",
    )
    assert voice_link_db.get_link_by_resident_and_date("R1", "2026-01-01") is None
    assert voice_link_db.get_link_by_resident_and_date("R-other", "2026-05-06") is None


def test_mark_used_still_works():
    link = voice_link_db.create_link(
        resident_id="R1", facility_id="F1", generated_by="N1",
        expires_at="2026-05-07T00:00:00+00:00",
    )
    assert voice_link_db.mark_used(link["token"]) is True
    assert voice_link_db.get_link(link["token"])["used"] is True
