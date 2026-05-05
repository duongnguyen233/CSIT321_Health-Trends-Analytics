"""Change-point detection on per-resident sub-score time series.

Uses ruptures.Pelt with an RBF kernel cost. A series of length N is fed
through Pelt to find break points; if any break is detected in the last
14 recordings, a `review` alert is created (dimension = the sub-score
whose series flagged).

Why not arq.cron: the project doesn't run arq. Phase 3 wires a single
asyncio task scheduled at FastAPI startup that wakes every 24 h. This is
acceptable for the MVP — see VOICE_BIOMARKER.md Adaptations table notes.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Mapping

import numpy as np

from app.services import voice_analysis_db, voice_profile_db, voice_score_db
from app.services.voice_score_vector import DIMENSIONS


logger = logging.getLogger(__name__)


CPD_LOOKBACK_DAYS = 14
CPD_DAILY_INTERVAL_S = 24 * 60 * 60
CPD_MIN_POINTS = 7  # ruptures needs enough samples to form two segments


def _detect_changepoint(series: np.ndarray, *, pen: float = 1.0) -> bool:
    """Return True if Pelt finds at least one breakpoint in the series.

    The penalty parameter `pen` is conservative: too low means many
    spurious breaks, too high means we miss real ones. 1.0 detects
    a clear level shift on the 0..100 sub-score scale; production may
    want to tune this based on observed false-positive rate.
    """
    if series.size < CPD_MIN_POINTS:
        return False
    try:
        import ruptures as rpt

        algo = rpt.Pelt(model="rbf").fit(series.astype(np.float64))
        breaks = algo.predict(pen=pen)
        # ruptures returns the index of the END of each segment; the
        # final entry is always len(series). A real breakpoint exists
        # only when there are >= 2 segments.
        return len([b for b in breaks if b < series.size]) >= 1
    except Exception as e:
        logger.warning("ruptures CPD failed: %s", e)
        return False


def changepoint_alerts_for_profile(
    profile_id: str,
    resident_id: str,
    *,
    lookback: int = CPD_LOOKBACK_DAYS,
) -> list[dict]:
    """Run CPD on each dimension's sub-score series and return alert dicts."""
    scores = voice_score_db.list_scores(profile_id, limit=lookback)
    if len(scores) < CPD_MIN_POINTS:
        return []
    scores = list(reversed(scores))  # oldest first for time-ordered series

    alerts: list[dict] = []
    for dim in DIMENSIONS:
        series = np.asarray(
            [float((s.get("subscores") or {}).get(dim) or 0.0) for s in scores],
            dtype=np.float64,
        )
        if not _detect_changepoint(series):
            continue
        latest = scores[-1]
        alerts.append({
            "profile_id": profile_id,
            "resident_id": resident_id,
            "recording_id": latest.get("recording_id") or "",
            "severity": "review",
            "dimension": dim,
            "summary": (
                f"Change-point detected in the {dim} sub-score over the last "
                f"{len(series)} recordings. Flagged for nurse review. "
                "This is a trend monitoring tool, not a diagnostic device."  # FRAMING_OK
            ),
        })
    return alerts


def run_changepoint_scan_for_facility(facility_id: str | None = None) -> int:
    """Iterate every voice profile, run CPD, persist any new alerts.

    Returns the number of alerts created. `facility_id=None` scans every
    profile across the in-memory store / Azure Tables (Phase 3 demo).
    """
    profiles: list[Mapping] = []
    table = voice_profile_db._get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter="PartitionKey eq 'resident'"))
            profiles = [voice_profile_db._entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("CPD profile scan failed (Tables): %s", e)
    else:
        profiles = [dict(p) for p in voice_profile_db._in_memory.values()]

    if facility_id:
        profiles = [p for p in profiles if p.get("facility_id") == facility_id]

    created = 0
    for p in profiles:
        if not p.get("baseline_blob_uri"):
            continue  # only flag CPD on baselined residents
        candidates = changepoint_alerts_for_profile(
            p["profile_id"], p.get("resident_id") or "",
        )
        for c in candidates:
            try:
                voice_analysis_db.create_dim_alert(**c)
                created += 1
            except Exception as e:
                logger.warning("CPD alert persist failed: %s", e)
    return created


# ---------------------------------------------------------------------------
# Asyncio loop wrapper (mounted from main.py @app.on_event('startup'))
# ---------------------------------------------------------------------------


async def cpd_loop_forever(
    *,
    interval_s: float = CPD_DAILY_INTERVAL_S,
) -> None:  # pragma: no cover — exercised by integration test, not unit test
    """Background loop: every `interval_s` seconds, run a facility-wide CPD scan.

    Sleeps first so we never block FastAPI startup waiting for ruptures.
    """
    while True:
        try:
            await asyncio.sleep(interval_s)
            n = run_changepoint_scan_for_facility()
            logger.info("nightly CPD scan created %d alerts", n)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("nightly CPD scan crashed; will retry next interval")
