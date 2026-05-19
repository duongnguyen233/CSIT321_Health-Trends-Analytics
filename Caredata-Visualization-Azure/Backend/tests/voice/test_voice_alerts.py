"""Tests for the alert evaluation rules."""
from __future__ import annotations
import re

import pytest

from app.services.voice_alerts import (
    REVIEW_CONCERN_SCORE,
    WATCH_SUB_SCORE,
    evaluate_alerts,
)


def _score(concern=0.0, **subs):
    full = dict({d: 0.0 for d in (
        "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
    )}, **subs)
    return {"concern_score": concern, "subscores": full, "recording_id": "rec"}


def _flags(**kwargs):
    return dict({"cold": False, "just_woke_up": False, "pain": False, "dentures_out": False}, **kwargs)


# ---------------------------------------------------------------------------
# Rule: watch
# ---------------------------------------------------------------------------


def test_watch_rule_fires_with_2_of_3_sub_score_high():
    today = _score(phonatory=80)
    history = [_score(phonatory=72), _score(phonatory=40)]
    alerts = evaluate_alerts(today_score=today, history=history)
    assert len(alerts) == 1
    a = alerts[0]
    assert a.severity == "watch"
    assert a.dimension == "phonatory"
    assert not a.suppressed


def test_watch_rule_does_not_fire_with_only_today_high():
    today = _score(phonatory=80)
    history = [_score(phonatory=10), _score(phonatory=10)]
    alerts = evaluate_alerts(today_score=today, history=history)
    assert alerts == []


def test_watch_rule_does_not_fire_when_under_threshold_today():
    today = _score(phonatory=65)
    history = [_score(phonatory=80)]
    alerts = evaluate_alerts(today_score=today, history=history)
    assert alerts == []


def test_watch_rule_can_fire_for_multiple_dimensions_simultaneously():
    today = _score(phonatory=80, prosodic=85)
    history = [_score(phonatory=75, prosodic=72)]
    alerts = evaluate_alerts(today_score=today, history=history)
    assert {a.dimension for a in alerts if a.severity == "watch"} == {
        "phonatory", "prosodic"
    }


# ---------------------------------------------------------------------------
# Rule: review
# ---------------------------------------------------------------------------


def test_review_rule_fires_with_2_of_3_concern_high():
    today = _score(concern=85, phonatory=80)
    history = [_score(concern=82, phonatory=70), _score(concern=50, phonatory=10)]
    alerts = evaluate_alerts(today_score=today, history=history)
    review_alerts = [a for a in alerts if a.severity == "review"]
    assert len(review_alerts) == 1
    assert review_alerts[0].dimension == "phonatory"


def test_review_rule_does_not_fire_with_isolated_high_concern():
    today = _score(concern=85)
    history = [_score(concern=20), _score(concern=20)]
    alerts = evaluate_alerts(today_score=today, history=history)
    assert all(a.severity != "review" for a in alerts)


# ---------------------------------------------------------------------------
# Cold-day suppression
# ---------------------------------------------------------------------------


def test_cold_on_all_qualifying_days_suppresses_watch_alert():
    today = _score(phonatory=80)
    history = [_score(phonatory=80), _score(phonatory=80)]
    alerts = evaluate_alerts(
        today_score=today,
        history=history,
        today_context_flags=_flags(cold=True),
        history_context_flags=[_flags(cold=True), _flags(cold=True)],
    )
    assert len(alerts) == 1
    assert alerts[0].suppressed is True
    assert alerts[0].suppression_reason == "all_qualifying_days_cold"


def test_cold_on_only_some_days_does_not_suppress():
    today = _score(phonatory=80)
    history = [_score(phonatory=80)]
    alerts = evaluate_alerts(
        today_score=today,
        history=history,
        today_context_flags=_flags(cold=True),
        history_context_flags=[_flags(cold=False)],
    )
    assert len(alerts) == 1
    assert alerts[0].suppressed is False


def test_just_woke_up_on_all_days_suppresses():
    today = _score(phonatory=80)
    history = [_score(phonatory=80)]
    alerts = evaluate_alerts(
        today_score=today,
        history=history,
        today_context_flags=_flags(just_woke_up=True),
        history_context_flags=[_flags(just_woke_up=True)],
    )
    assert alerts[0].suppression_reason == "all_qualifying_days_just_woke_up"


# ---------------------------------------------------------------------------
# Framing rule (forbidden words in alert summaries)
# ---------------------------------------------------------------------------


_FORBIDDEN = re.compile(
    r"\b(stroke|tia|dementia|alzheimer|parkinson|delirium|"
    r"depress\w*|dysphagia|psychosis|psychotic|schizo\w*|bipolar|diagnos[ie]s|diagnose[ds]?)\b",
    re.IGNORECASE,
)


def test_no_forbidden_words_in_watch_summaries():
    for dim in ("phonatory", "articulatory", "prosodic", "respiratory", "linguistic"):
        today = _score(**{dim: 80})
        history = [_score(**{dim: 80})]
        alerts = evaluate_alerts(today_score=today, history=history)
        for a in alerts:
            assert not _FORBIDDEN.search(a.summary), (
                f"forbidden word in {dim} watch summary: {a.summary!r}"
            )


def test_no_forbidden_words_in_review_summaries():
    today = _score(concern=85, phonatory=80)
    history = [_score(concern=82, phonatory=80)]
    alerts = evaluate_alerts(today_score=today, history=history)
    for a in alerts:
        if a.severity == "review":
            # FRAMING_OK appears as a code marker; it's not user-facing text
            text = a.summary.replace("FRAMING_OK", "")
            assert not _FORBIDDEN.search(text), (
                f"forbidden word in review summary: {a.summary!r}"
            )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_no_alerts_when_today_score_is_none():
    assert evaluate_alerts(today_score=None, history=[]) == []


def test_qualifying_recording_ids_collected():
    today = {
        "concern_score": 85, "recording_id": "today",
        "subscores": {d: (85.0 if d == "phonatory" else 0.0) for d in (
            "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
        )},
    }
    history = [
        {"concern_score": 82, "recording_id": "y1",
         "subscores": {d: 70.0 if d == "phonatory" else 0.0 for d in (
             "phonatory", "articulatory", "prosodic", "respiratory", "linguistic"
         )}},
    ]
    alerts = evaluate_alerts(today_score=today, history=history)
    review_alerts = [a for a in alerts if a.severity == "review"]
    assert "today" in review_alerts[0].qualifying_recording_ids
    assert "y1" in review_alerts[0].qualifying_recording_ids
