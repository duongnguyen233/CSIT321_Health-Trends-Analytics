"""
Store and retrieve resident voice profiles in Azure Table Storage.
PartitionKey="resident", RowKey=profile_id. In-memory fallback when Azure not configured.
"""
import logging
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
TABLE_NAME = "voiceresidents"
_in_memory: dict[str, dict] = {}  # profile_id -> profile dict


def _get_table():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
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


def _entity_to_dict(e: dict) -> dict:
    return {
        "profile_id": e.get("profile_id") or e.get("RowKey"),
        "resident_id": e.get("resident_id"),
        "facility_id": e.get("facility_id"),
        "display_name": e.get("display_name"),
        "password_hash": e.get("password_hash"),
        "consent_status": e.get("consent_status", "active"),
        "baseline_established": e.get("baseline_established", False),
        "baseline_recording_count": e.get("baseline_recording_count", 0),
        "last_recording_date": e.get("last_recording_date"),
        "created_at": e.get("created_at"),
        # Phase 3 baseline fields
        "baseline_locked_at": e.get("baseline_locked_at"),
        "baseline_version": e.get("baseline_version", 0),
        "baseline_blob_uri": e.get("baseline_blob_uri") or e.get("baseline_blob_key"),
    }


def create_profile(
    resident_id: str,
    facility_id: str,
    display_name: str,
    password_hash: str = "",
    consent_status: str = "active",
) -> dict:
    """Create a new resident voice profile. Returns profile dict.

    `password_hash` defaults to empty for v2 token-only enrolment; legacy
    callers may continue to pass a real bcrypt hash for the v1 resident-
    portal flow.
    """
    profile_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "profile_id": profile_id,
        "resident_id": resident_id,
        "facility_id": facility_id,
        "display_name": display_name,
        "password_hash": password_hash,
        "consent_status": consent_status,
        "baseline_established": False,
        "baseline_recording_count": 0,
        "last_recording_date": None,
        "created_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": "resident",
                "RowKey": profile_id,
                **entity,
            })
            return entity
        except Exception as e:
            logger.warning("create_profile: %s", e)
            raise
    _in_memory[profile_id] = entity
    return entity


def get_by_id(profile_id: str) -> dict | None:
    """Retrieve profile by profile_id."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key="resident", row_key=profile_id)
            return _entity_to_dict(e)
        except Exception:
            return None
    p = _in_memory.get(profile_id)
    return dict(p) if p else None


def get_by_resident_id(resident_id: str) -> dict | None:
    """Find profile by the linked resident_id."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"PartitionKey eq 'resident' and resident_id eq '{resident_id}'"
            ))
            if entities:
                return _entity_to_dict(entities[0])
            return None
        except Exception as e:
            logger.warning("get_by_resident_id: %s", e)
            return None
    for p in _in_memory.values():
        if p.get("resident_id") == resident_id:
            return dict(p)
    return None


def update_profile(profile_id: str, updates: dict) -> bool:
    """Update fields on an existing profile."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key="resident", row_key=profile_id)
            e.update(updates)
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    p = _in_memory.get(profile_id)
    if p:
        p.update(updates)
        return True
    return False


def list_by_facility(facility_id: str) -> list[dict]:
    """List all profiles for a facility."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"PartitionKey eq 'resident' and facility_id eq '{facility_id}'"
            ))
            return [_entity_to_dict(e) for e in entities]
        except Exception as e:
            logger.warning("list_by_facility: %s", e)
            return []
    return [dict(p) for p in _in_memory.values() if p.get("facility_id") == facility_id]
