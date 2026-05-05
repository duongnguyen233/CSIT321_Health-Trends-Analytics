"""Tests for ruptures-based change-point detection on sub-score series."""
from __future__ import annotations

import numpy as np
import pytest

from app.services import (
    voice_analysis_db,
    voice_changepoint,
    voice_profile_db,
    voice_score_db,
)


@pytest.fixture(autouse=True)
def _clear():
    voice_score_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()
    yield
    voice_score_db._in_memory.clear()
    voice_profile_db._in_memory.clear()
    voice_analysis_db._dim_alerts_in_memory.clear()


def test_detect_changepoint_returns_false_on_flat_series():
    flat = np.zeros(14, dtype=np.float64)
    assert voice_changepoint._detect_changepoint(flat) is False


def test_detect_changepoint_returns_true_on_step_series():
    """A clear level shift halfway through should be flagged."""
    series = np.concatenate([np.zeros(7), np.ones(7) * 50.0])
    assert voice_changepoint._detect_changepoint(series) is True


def test_detect_changepoint_returns_false_below_min_points():
    series = np.array([0.0, 1.0, 0.0, 1.0])
    assert voice_changepoint._detect_changepoint(series) is False


def test_changepoint_alerts_for_profile_emits_review_alert_on_shift():
    profile_id = "P-drift"
    # Seed 14 scores: first 7 with phonatory ~ 0, next 7 with phonatory ~ 80
    for i in range(14):
        sub = 0.0 if i < 7 else 80.0
        voice_score_db.create_score(
            profile_id=profile_id,
            recording_id=f"r{i}",
            concern_score=float(sub),
            subscores={
                "phonatory": sub,
                "articulatory": 0.0, "prosodic": 0.0,
                "respiratory": 0.0, "linguistic": 0.0,
            },
        )

    alerts = voice_changepoint.changepoint_alerts_for_profile(
        profile_id, "R-drift",
    )
    assert any(a["dimension"] == "phonatory" and a["severity"] == "review" for a in alerts)


def test_changepoint_summary_has_no_disease_words():
    """Smoke test: alert summary uses dimension language."""
    profile_id = "P-drift"
    for i in range(14):
        sub = 0.0 if i < 7 else 80.0
        voice_score_db.create_score(
            profile_id=profile_id, recording_id=f"r{i}",
            concern_score=float(sub),
            subscores={d: (sub if d == "phonatory" else 0.0) for d in (
                "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
            )},
        )
    alerts = voice_changepoint.changepoint_alerts_for_profile(profile_id, "R-drift")
    forbidden = ["stroke", "dementia", "depression", "delirium", "diagnose"]
    for a in alerts:
        text = a["summary"].replace("FRAMING_OK", "").lower()
        for term in forbidden:
            assert term not in text, f"forbidden term {term!r} in alert: {a['summary']}"


def test_run_changepoint_scan_only_processes_baselined_residents():
    # Profile A: baselined + drift
    a = voice_profile_db.create_profile(
        resident_id="R-A", facility_id="F", display_name="A", password_hash="x",
    )
    voice_profile_db.update_profile(a["profile_id"], {
        "baseline_blob_uri": "memory://model-artifacts/x.joblib",
    })
    for i in range(14):
        voice_score_db.create_score(
            profile_id=a["profile_id"], recording_id=f"a{i}",
            concern_score=80.0 if i >= 7 else 0.0,
            subscores={d: (80.0 if d == "phonatory" and i >= 7 else 0.0) for d in (
                "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
            )},
        )

    # Profile B: NOT baselined; should be skipped even with drift
    b = voice_profile_db.create_profile(
        resident_id="R-B", facility_id="F", display_name="B", password_hash="x",
    )
    for i in range(14):
        voice_score_db.create_score(
            profile_id=b["profile_id"], recording_id=f"b{i}",
            concern_score=80.0 if i >= 7 else 0.0,
            subscores={d: (80.0 if d == "phonatory" and i >= 7 else 0.0) for d in (
                "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
            )},
        )

    n = voice_changepoint.run_changepoint_scan_for_facility()
    assert n >= 1  # at least Profile A

    alerts = voice_analysis_db.list_dim_alerts(open_only=False)
    profile_ids = {a["profile_id"] for a in alerts}
    assert a["profile_id"] in profile_ids  # Profile A persisted
    assert b["profile_id"] not in profile_ids  # Profile B skipped (no baseline)
