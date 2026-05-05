"""Tests for the per-feature EWMA drift state."""
from __future__ import annotations

from app.services.voice_ewma import breached_features, update_ewma


def test_initial_state_is_zero():
    state = update_ewma(None, {"praat.jitter_local": 0.0})
    assert state["praat.jitter_local"]["ema"] == 0.0
    assert state["praat.jitter_local"]["breach_streak"] == 0
    assert state["praat.jitter_local"]["breached"] is False


def test_breach_streak_advances_with_consecutive_high_deltas():
    """EMA with alpha=0.3 and deltas of 8.0 climbs past 3.0 MADs after a
    couple of iterations and then keeps incrementing the streak each step."""
    state = None
    for _ in range(10):
        state = update_ewma(state, {"f": 8.0})
    assert state["f"]["breach_streak"] >= 5
    assert state["f"]["breached"] is True


def test_breach_streak_resets_when_delta_drops():
    state = None
    for _ in range(3):
        state = update_ewma(state, {"f": 5.0})
    state = update_ewma(state, {"f": 0.0})
    assert state["f"]["breach_streak"] == 0
    # A single 0 will not push EMA below threshold immediately because
    # alpha=0.3 -> smoothed value drops gradually; nonetheless streak resets.


def test_default_threshold_is_3_mads():
    """Just under 3 MADs should not breach."""
    state = None
    for _ in range(10):
        state = update_ewma(state, {"f": 2.5})
    assert state["f"]["breached"] is False


def test_breached_features_helper():
    state = {
        "a": {"ema": 5.0, "breach_streak": 5, "breached": True},
        "b": {"ema": 1.0, "breach_streak": 1, "breached": False},
    }
    assert breached_features(state) == ["a"]
