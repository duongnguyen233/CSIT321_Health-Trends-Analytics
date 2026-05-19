"""Per-feature exponentially-weighted moving average for drift control charts.

Each new recording's robust-z deltas are folded into a per-feature EWMA
state: smoothed value + variance estimate + a breach flag when the
smoothed signal stays > `threshold_mads` for `consecutive` recordings.

State is stored as a dict so it can be persisted alongside per-resident
baselines (Phase 3 keeps it in-memory; future phases may add it to the
baseline blob bundle).
"""
from __future__ import annotations

from typing import Mapping


DEFAULT_ALPHA = 0.3
DEFAULT_THRESHOLD_MADS = 3.0
DEFAULT_CONSECUTIVE = 5


def update_ewma(
    state: dict[str, dict[str, float]] | None,
    deltas: Mapping[str, float],
    *,
    alpha: float = DEFAULT_ALPHA,
    threshold_mads: float = DEFAULT_THRESHOLD_MADS,
    consecutive: int = DEFAULT_CONSECUTIVE,
) -> dict[str, dict[str, float]]:
    """Fold new robust-z deltas into the EWMA state.

    Returns the updated state dict (keyed by feature name) where each
    value is `{ema, breach_streak, breached}`.
    """
    if state is None:
        state = {}
    new_state: dict[str, dict[str, float]] = {}
    for name, z in deltas.items():
        prev = state.get(name, {"ema": 0.0, "breach_streak": 0, "breached": False})
        ema = float(alpha) * float(z) + (1.0 - float(alpha)) * float(prev["ema"])
        if abs(ema) > threshold_mads:
            streak = int(prev["breach_streak"]) + 1
        else:
            streak = 0
        new_state[name] = {
            "ema": ema,
            "breach_streak": streak,
            "breached": bool(streak >= consecutive),
        }
    return new_state


def breached_features(state: Mapping[str, Mapping[str, float]]) -> list[str]:
    """Return the names of features whose EWMA has been breached."""
    return [name for name, s in state.items() if s.get("breached")]
