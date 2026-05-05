"""Persist extracted feature dicts (Phase 2 schema).

PartitionKey = f"feat-{profile_id}", RowKey = recording_id. The feature
sub-blocks (eGeMAPS, Praat, DDK, linguistic, transcript) are JSON-encoded
into the entity since Azure Tables can't hold dicts.

In-memory fallback for dev / tests, mirroring the pattern of
voice_recording_db, voice_score_db, etc.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from app.core.config import settings


logger = logging.getLogger(__name__)
TABLE_NAME = "voicefeatures"

# profile_id -> {recording_id -> features dict}
_in_memory: dict[str, dict[str, dict]] = {}

_DICT_COLUMNS: tuple[str, ...] = (
    "egemaps_sustained_a",
    "egemaps_reading",
    "egemaps_open_prompt",
    "praat",
    "ddk",
    "linguistic",
)


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
    return f"feat-{profile_id}"


def _jsonify(d: dict) -> dict:
    out = dict(d)
    for col in _DICT_COLUMNS:
        if col in out and out[col] is not None and isinstance(out[col], (dict, list)):
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
        "profile_id": (e.get("PartitionKey") or "").removeprefix("feat-")
        or e.get("profile_id"),
        "recording_id": e.get("recording_id") or e.get("RowKey"),
        "egemaps_sustained_a": e.get("egemaps_sustained_a"),
        "egemaps_reading": e.get("egemaps_reading"),
        "egemaps_open_prompt": e.get("egemaps_open_prompt"),
        "praat": e.get("praat"),
        "ddk": e.get("ddk"),
        "linguistic": e.get("linguistic"),
        "transcript": e.get("transcript"),
        "snr_db": e.get("snr_db"),
        "voiced_duration_s": e.get("voiced_duration_s"),
        "duration_s": e.get("duration_s"),
        "extracted_at": e.get("extracted_at"),
    }
    return _dejsonify(base)


def create_features(
    *,
    profile_id: str,
    recording_id: str,
    features: dict,
) -> dict:
    """Persist a features dict for a recording. Overwrites any existing row."""
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "profile_id": profile_id,
        "recording_id": recording_id,
        "egemaps_sustained_a": features.get("egemaps_sustained_a"),
        "egemaps_reading": features.get("egemaps_reading"),
        "egemaps_open_prompt": features.get("egemaps_open_prompt"),
        "praat": features.get("praat"),
        "ddk": features.get("ddk"),
        "linguistic": features.get("linguistic"),
        "transcript": features.get("transcript", ""),
        "snr_db": features.get("snr_db"),
        "voiced_duration_s": features.get("voiced_duration_s"),
        "duration_s": features.get("duration_s"),
        "extracted_at": now,
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
            logger.warning("create_features: %s", e)
            raise
    if profile_id not in _in_memory:
        _in_memory[profile_id] = {}
    _in_memory[profile_id][recording_id] = entity
    return entity


def get_features(profile_id: str, recording_id: str) -> dict | None:
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
