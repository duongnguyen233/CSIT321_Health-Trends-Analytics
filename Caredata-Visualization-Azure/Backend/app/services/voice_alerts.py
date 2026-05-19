"""Conservative alert evaluation rules.

Per VOICE_BIOMARKER.md \xa78.3 (with the framing rule applied), alerts come
in two severities and never name a disease:

- severity='watch'  : sub-score > 70 today AND sub-score >= 70 on at
                       least 1 of the previous 2 days  (the "2-of-3" rule)
- severity='review' : EITHER concern_score > 80 today AND on >= 2 of the
                       previous 3 days, OR a Pelt change-point on any
                       sub-score series in the last 14 days (handled by
                       voice_changepoint, not here)

Cold-day suppression: if context_flags.cold or context_flags.just_woke_up
is True on ALL of the qualifying days for a given alert, the alert is
suppressed and a logged reason is returned via the suppression record.

evaluate_alerts is a *pure* function — no DB writes, no IO. The caller
(worker / cron) decides what to persist.

Forbidden-words contract: every summary template uses dimension language
only. The framing test (`test_framing.py`) scans this file for offending
terms; do NOT add disease names here.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Iterable, Mapping

from app.services.voice_score_vector import DIMENSIONS


logger = logging.getLogger(__name__)


# Thresholds (kept here as named constants for tweakability)
WATCH_SUB_SCORE = 70.0
REVIEW_CONCERN_SCORE = 80.0


@dataclass
class AlertCandidate:
    severity: str  # info | watch | review
    dimension: str  # phonatory | articulatory | prosodic | respiratory | linguistic
    summary: str
    suppressed: bool = False
    suppression_reason: str | None = None
    qualifying_recording_ids: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Public — pure evaluation
# ---------------------------------------------------------------------------


def evaluate_alerts(
    *,
    today_score: Mapping,
    history: list[Mapping],
    today_context_flags: Mapping | None = None,
    history_context_flags: list[Mapping] | None = None,
) -> list[AlertCandidate]:
    """Evaluate alert rules for one resident at one point in time.

    Args:
        today_score: latest Score row dict (concern_score + subscores).
        history: prior Score row dicts ordered NEWEST first (today is NOT
            included). Caller passes at most 13 (last 14 days).
        today_context_flags: ContextFlags-shaped dict for today.
        history_context_flags: list of ContextFlags-shaped dicts aligned
            to `history` (same order).

    Returns:
        List of AlertCandidate. Suppressed candidates are still included
        with `suppressed=True` so the caller can log them.
    """
    alerts: list[AlertCandidate] = []
    today_context_flags = today_context_flags or {}
    history_context_flags = history_context_flags or [{}] * len(history)

    if today_score is None:
        return alerts

    today_concern = float(today_score.get("concern_score") or 0.0)
    today_subs = today_score.get("subscores") or {}

    # ---- Rule: watch (2-of-3 sub-score >= 70) ------------------------------
    for dim in DIMENSIONS:
        sub = float(today_subs.get(dim) or 0.0)
        if sub <= WATCH_SUB_SCORE:
            continue
        # Look back two days
        prior_subs = [
            float((h.get("subscores") or {}).get(dim) or 0.0) for h in history[:2]
        ]
        prior_hits = sum(1 for v in prior_subs if v >= WATCH_SUB_SCORE)
        if prior_hits < 1:
            continue

        # Cold-day suppression: cold OR just-woke-up on ALL qualifying days
        qualifying_flags = [today_context_flags] + [
            history_context_flags[i] for i in range(min(2, len(history_context_flags)))
        ]
        suppressed, reason = _check_suppression(qualifying_flags)

        alerts.append(AlertCandidate(
            severity="watch",
            dimension=dim,
            summary=_watch_summary(dim),
            suppressed=suppressed,
            suppression_reason=reason,
            qualifying_recording_ids=_collect_recording_ids(today_score, history[:2]),
        ))

    # ---- Rule: review (concern >= 80 on >= 2 of last 3 days) --------------
    if today_concern >= REVIEW_CONCERN_SCORE:
        prior_concern = [float(h.get("concern_score") or 0.0) for h in history[:3]]
        prior_hits = sum(1 for v in prior_concern if v >= REVIEW_CONCERN_SCORE)
        if prior_hits >= 1:
            qualifying_flags = [today_context_flags] + [
                history_context_flags[i]
                for i in range(min(3, len(history_context_flags)))
            ]
            suppressed, reason = _check_suppression(qualifying_flags)

            # Pick the worst-shifted dimension as the alert's "dimension"
            top_dim = max(
                DIMENSIONS,
                key=lambda d: float((today_subs.get(d) or 0.0)),
            )

            alerts.append(AlertCandidate(
                severity="review",
                dimension=top_dim,
                summary=_review_summary(top_dim),
                suppressed=suppressed,
                suppression_reason=reason,
                qualifying_recording_ids=_collect_recording_ids(
                    today_score, history[:3]
                ),
            ))

    return alerts


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_suppression(flags_list: Iterable[Mapping]) -> tuple[bool, str | None]:
    flags_list = list(flags_list)
    if not flags_list:
        return False, None
    if all(bool(f.get("cold")) for f in flags_list):
        return True, "all_qualifying_days_cold"
    if all(bool(f.get("just_woke_up")) for f in flags_list):
        return True, "all_qualifying_days_just_woke_up"
    return False, None


def _collect_recording_ids(today_score: Mapping, history: list[Mapping]) -> list[str]:
    ids: list[str] = []
    rid = today_score.get("recording_id")
    if rid:
        ids.append(str(rid))
    for h in history:
        rid = h.get("recording_id")
        if rid:
            ids.append(str(rid))
    return ids


# ---------------------------------------------------------------------------
# Templated summaries — dimension language ONLY (FRAMING_OK below clarifies)
# ---------------------------------------------------------------------------


_DIMENSION_NOUN = {
    "phonatory": "Voice quality",
    "articulatory": "Speech clarity",
    "prosodic": "Speech rhythm",
    "respiratory": "Breath support",
    "linguistic": "Language fluency",
}


def _watch_summary(dim: str) -> str:
    noun = _DIMENSION_NOUN.get(dim, dim.title())
    return (
        f"{noun} ({dim}) has been unusual for 2 of the last 3 recordings. "
        "Flagged for nurse review."
    )


def _review_summary(dim: str) -> str:
    noun = _DIMENSION_NOUN.get(dim, dim.title())
    return (
        f"{noun} ({dim}) shows a sustained shift across the last several recordings. "
        "Recommend nurse review and consider clinical re-assessment. "
        "This is a trend monitoring tool, not a diagnostic device."  # FRAMING_OK
    )
