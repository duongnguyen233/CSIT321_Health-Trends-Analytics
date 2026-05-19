"""Per-recording score persistence — Azure Table Storage with in-memory fallback.

Schema (per VOICE_BIOMARKER.md \xa76):
- PartitionKey:    f"score-{profile_id}"
- RowKey:          recording_id
- concern_score:   float in [0, 100]
- subscores:       dict[dimension -> float in [0, 100]] (5 dimensions)
- mahalanobis:     float or None (raw distance in PCA space)
- iforest:         float or None (raw isolation-forest score)
- feature_deltas:  dict[feature_name -> robust_z] for tooltips, optional
- scored_at:       ISO 8601 UTC timestamp

The dict-typed columns are JSON-encoded for Tables; decoded on read.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings


logger = logging.getLogger(__name__)
TABLE_NAME = "voicescores"

# profile_id -> {recording_id -> score dict}
_in_memory: dict[str, dict[str, dict]] = {}

_DICT_COLUMNS: tuple[str, ...] = ("subscores", "feature_deltas")


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get(
        "AZURE_STORAGE_CONNECTION_STRING"
    )
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient

        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table(TABLE_NAME)
        except Exception as e:
            if "TableAlreadyExists" not in str(e) and "409" not in str(e):
                raise
        return client.get_table_client(TABLE_NAME)
    except Exception as e:
        logger.warning("Azure %s not available: %s", TABLE_NAME, e)
        return None


def _partition(profile_id: str) -> str:
    return f"score-{profile_id}"


def _jsonify(d: dict) -> dict:
    out = dict(d)
    for col in _DICT_COLUMNS:
        if col in out and isinstance(out[col], (dict, list)):
            out[col] = json.dumps(out[col])
    return out


def _dejsonify(d: dict) -> dict:
    out = dict(d)
    for col in _DICT_COLUMNS:
        if col in out and isinstance(out[col], str):
            try:
                out[col] = json.loads(out[col])
            except json.JSONDecodeError:
                pass
    return out


def _entity_to_dict(e: dict) -> dict:
    base = {
        "profile_id": (e.get("PartitionKey") or "").removeprefix("score-")
        or e.get("profile_id"),
        "recording_id": e.get("recording_id") or e.get("RowKey"),
        "concern_score": e.get("concern_score"),
        "mahalanobis": e.get("mahalanobis"),
        "iforest": e.get("iforest"),
        "subscores": e.get("subscores"),
        "feature_deltas": e.get("feature_deltas"),
        "scored_at": e.get("scored_at"),
    }
    return _dejsonify(base)


def create_score(
    *,
    profile_id: str,
    recording_id: str,
    concern_score: float,
    subscores: dict[str, float],
    mahalanobis: float | None = None,
    iforest: float | None = None,
    feature_deltas: dict[str, float] | None = None,
) -> dict:
    """Persist a score row. Overwrites any existing row for the same recording."""
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "profile_id": profile_id,
        "recording_id": recording_id,
        "concern_score": concern_score,
        "mahalanobis": mahalanobis,
        "iforest": iforest,
        "subscores": subscores,
        "feature_deltas": feature_deltas,
        "scored_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": _partition(profile_id),
                "RowKey": recording_id,
                **_jsonify(entity),
            })
            return entity
        except Exception as e:
            logger.warning("create_score: %s", e)
            raise
    if profile_id not in _in_memory:
        _in_memory[profile_id] = {}
    _in_memory[profile_id][recording_id] = entity
    return entity


def get_score(profile_id: str, recording_id: str) -> dict | None:
    table = _get_table()
    if table:
        try:
            e = table.get_entity(
                partition_key=_partition(profile_id), row_key=recording_id
            )
            return _entity_to_dict(e)
        except Exception:
            return None
    rec = _in_memory.get(profile_id, {}).get(recording_id)
    return dict(rec) if rec else None


def list_scores(profile_id: str, limit: int = 60) -> list[dict]:
    """Return the most recent `limit` scores for a profile, newest first."""
    table = _get_table()
    if table:
        try:
            entities = list(
                table.query_entities(
                    query_filter=f"PartitionKey eq '{_partition(profile_id)}'"
                )
            )
            items = [_entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("list_scores: %s", e)
            return []
    else:
        items = [dict(s) for s in _in_memory.get(profile_id, {}).values()]
    items.sort(key=lambda x: x.get("scored_at") or "", reverse=True)
    return items[:limit]
