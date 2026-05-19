"""Tests for the 4-stage voice biomarker recording script."""
from __future__ import annotations

from app.api.voice_prompts import (
    REQUIRED_STAGE_IDS,
    SCRIPT_DISCLAIMER,
    get_script,
)


def test_get_script_returns_v1_with_four_stages():
    s = get_script()
    assert s["version"] == "v1"
    assert len(s["stages"]) == 4


def test_stages_are_in_canonical_order():
    s = get_script()
    ids = [stage["id"] for stage in s["stages"]]
    assert tuple(ids) == REQUIRED_STAGE_IDS


def test_each_stage_has_required_fields():
    s = get_script()
    for stage in s["stages"]:
        assert "id" in stage
        assert "type" in stage
        assert "text" in stage
        assert "target_duration_s" in stage
        assert isinstance(stage["target_duration_s"], (int, float))
        assert stage["target_duration_s"] > 0


def test_total_target_duration_is_about_75_seconds():
    s = get_script()
    total = sum(stage["target_duration_s"] for stage in s["stages"])
    assert 60 <= total <= 90, f"expected ~75s total, got {total}s"


def test_open_prompt_is_the_longest_stage():
    s = get_script()
    by_id = {stage["id"]: stage for stage in s["stages"]}
    longest_id = max(by_id, key=lambda k: by_id[k]["target_duration_s"])
    assert longest_id == "open_prompt"


def test_disclaimer_text_does_not_name_a_disease():
    # belt-and-braces: the framing rule test scans files; this asserts the
    # constant directly.
    forbidden = ["stroke", "dementia", "depression", "delirium", "diagnosis", "diagnose"]
    lowered = SCRIPT_DISCLAIMER.lower()
    for term in forbidden:
        assert term not in lowered, f"disclaimer contains forbidden term: {term!r}"


def test_get_script_unknown_version_raises():
    import pytest
    with pytest.raises(ValueError):
        get_script(version="v99")
