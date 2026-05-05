"""
Store and retrieve voice recordings in Azure Table Storage.
PartitionKey=profile_id, RowKey=recording_id. In-memory fallback when Azure
not configured.

Phase 1 schema additions (per VOICE_BIOMARKER.md \xa76):
- audio_blob_uri  : opaque URI returned by voice_audio_blob.upload_audio
- stage_offsets   : per-stage [start, end] seconds (dict; JSON-encoded for Tables)
- context_flags   : resident-self-reported flags (dict; JSON-encoded)
- client_meta     : MediaStream constraints + UA snapshot (dict; JSON-encoded)
- snr_db          : signal-to-noise ratio in dB; None until features extracted
- status          : uploaded | processing | done | failed (extended in Phase 2)

Legacy `audio_file_path` is preserved for back-compat with the (deprecated)
`/api/voice/recordings` upload path that writes to disk.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings


logger = logging.getLogger(__name__)
TABLE_NAME = "voicerecordings"

# profile_id -> {recording_id -> recording dict}
_in_memory: dict[str, dict[str, dict]] = {}

# In-memory audio storage (legacy dev fallback for the old upload endpoint)
_in_memory_audio: dict[str, bytes] = {}

# Columns that should be stored as JSON strings in Azure Tables.
_DICT_COLUMNS: tuple[str, ...] = ("stage_offsets", "context_flags", "client_meta")


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


def _jsonify_dicts(data: dict) -> dict:
    """Return a copy of `data` with known dict columns JSON-encoded."""
    out = dict(data)
    for col in _DICT_COLUMNS:
        if col in out and isinstance(out[col], (dict, list)):
            out[col] = json.dumps(out[col])
    return out


def _dejsonify_dicts(data: dict) -> dict:
    """Return a copy of `data` with known dict columns JSON-decoded."""
    out = dict(data)
    for col in _DICT_COLUMNS:
        if col in out and isinstance(out[col], str):
            try:
                out[col] = json.loads(out[col])
            except json.JSONDecodeError:
                pass
    return out


def _entity_to_dict(e: dict) -> dict:
    base = {
        "recording_id": e.get("recording_id") or e.get("RowKey"),
        "profile_id": e.get("profile_id") or e.get("PartitionKey"),
        "duration_s": e.get("duration_s", 0),
        "prompt_id": e.get("prompt_id"),
        "audio_blob_uri": e.get("audio_blob_uri"),
        "audio_file_path": e.get("audio_file_path"),
        "stage_offsets": e.get("stage_offsets"),
        "context_flags": e.get("context_flags"),
        "client_meta": e.get("client_meta"),
        "snr_db": e.get("snr_db"),
        "status": e.get("status", "uploaded"),
        "created_at": e.get("created_at"),
    }
    return _dejsonify_dicts(base)


def create_recording(
    profile_id: str,
    duration_s: float,
    prompt_id: str,
    *,
    audio_blob_uri: str | None = None,
    audio_file_path: str | None = None,
    stage_offsets: dict | None = None,
    context_flags: dict | None = None,
    client_meta: dict | None = None,
    recording_id: str | None = None,
    snr_db: float | None = None,
) -> dict:
    """Create a new recording entry. Returns recording dict.

    `audio_blob_uri` is the new canonical pointer to the audio bytes; the
    legacy `audio_file_path` argument remains for the deprecated filesystem
    upload path.
    """
    if recording_id is None:
        recording_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "recording_id": recording_id,
        "profile_id": profile_id,
        "duration_s": duration_s,
        "prompt_id": prompt_id,
        "audio_blob_uri": audio_blob_uri,
        "audio_file_path": audio_file_path,
        "stage_offsets": stage_offsets,
        "context_flags": context_flags,
        "client_meta": client_meta,
        "snr_db": snr_db,
        "status": "uploaded",
        "created_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": profile_id,
                "RowKey": recording_id,
                **_jsonify_dicts(entity),
            })
            return entity
        except Exception as e:
            logger.warning("create_recording: %s", e)
            raise
    if profile_id not in _in_memory:
        _in_memory[profile_id] = {}
    _in_memory[profile_id][recording_id] = entity
    return entity


def get_recording(profile_id: str, recording_id: str) -> dict | None:
    """Retrieve a single recording."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=recording_id)
            return _entity_to_dict(e)
        except Exception:
            return None
    rec = _in_memory.get(profile_id, {}).get(recording_id)
    return dict(rec) if rec else None


def list_recordings(profile_id: str) -> list[dict]:
    """List all recordings for a profile, newest first."""
    table = _get_table()
    if table:
        try:
            entities = list(
                table.query_entities(query_filter=f"PartitionKey eq '{profile_id}'")
            )
            items = [_entity_to_dict(e) for e in entities]
            items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
            return items
        except Exception as e:
            logger.warning("list_recordings: %s", e)
            return []
    items = [dict(r) for r in _in_memory.get(profile_id, {}).values()]
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


def update_status(profile_id: str, recording_id: str, status: str) -> bool:
    """Update recording status (uploaded/processing/done/analyzed/failed)."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=recording_id)
            e["status"] = status
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    rec = _in_memory.get(profile_id, {}).get(recording_id)
    if rec:
        rec["status"] = status
        return True
    return False


def set_quality_metrics(
    profile_id: str,
    recording_id: str,
    *,
    snr_db: float | None = None,
) -> bool:
    """Persist SNR (and future quality metrics) onto an existing recording."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key=profile_id, row_key=recording_id)
            if snr_db is not None:
                e["snr_db"] = snr_db
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    rec = _in_memory.get(profile_id, {}).get(recording_id)
    if rec is None:
        return False
    if snr_db is not None:
        rec["snr_db"] = snr_db
    return True


def delete_recording(profile_id: str, recording_id: str) -> bool:
    """Delete a recording entry. Returns True if deleted."""
    table = _get_table()
    if table:
        try:
            table.delete_entity(partition_key=profile_id, row_key=recording_id)
            return True
        except Exception:
            return False
    recs = _in_memory.get(profile_id, {})
    if recording_id in recs:
        del recs[recording_id]
        _in_memory_audio.pop(recording_id, None)
        return True
    return False


def store_audio(recording_id: str, audio_bytes: bytes) -> None:
    """Legacy in-memory audio store. New code should use voice_audio_blob."""
    _in_memory_audio[recording_id] = audio_bytes


def get_audio(recording_id: str) -> bytes | None:
    """Legacy in-memory audio fetch. New code should use voice_audio_blob."""
    return _in_memory_audio.get(recording_id)
