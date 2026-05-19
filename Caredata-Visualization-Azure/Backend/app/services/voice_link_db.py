"""
Store and retrieve voice recording links in Azure Table Storage.
PartitionKey="link", RowKey=token. In-memory fallback when Azure not configured.

Two flavours of link coexist on the same table:

- **Persistent link** (`is_persistent=True`): exactly one per resident,
  never expires, never marked used. Created automatically when the
  voice profile is created. The resident keeps this URL forever and
  reuses it for every daily recording. This is the model the project
  actually uses today.

- **Daily link** (`is_persistent=False`): single-use, scoped to a
  `valid_for_date`. Kept around because the spec describes it and a
  small number of older callers still rely on it.

`get_persistent_link_for_resident(resident_id)` returns the persistent
row if one exists; `create_persistent_link(resident_id, facility_id,
generated_by)` is idempotent and always returns the same row.
"""
import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)
TABLE_NAME = "voicelinks"
_in_memory: dict[str, dict] = {}  # token -> link dict


# Far-future expiry stamp used for persistent links. We still set one so
# the existing `expires_at`-aware code paths stay simple — but in practice
# callers should look at `is_persistent` to decide whether the link can
# still be used.
_FAR_FUTURE = (datetime(2099, 12, 31, tzinfo=timezone.utc)).isoformat()


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


def create_link(
    resident_id: str,
    facility_id: str,
    generated_by: str,
    expires_at: str,
    valid_for_date: str | None = None,
) -> dict:
    """Create a new recording link. Returns link dict with token.

    `valid_for_date` is the ISO date the link is intended for (one link per
    resident per day). When omitted, defaults to today (UTC) for backwards
    compatibility with callers that pre-date the new schema.
    """
    if valid_for_date is None:
        valid_for_date = date.today().isoformat()
    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "token": token,
        "resident_id": resident_id,
        "facility_id": facility_id,
        "generated_by": generated_by,
        "expires_at": expires_at,
        "valid_for_date": valid_for_date,
        "used": False,
        "used_at": None,
        "created_at": now,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": "link",
                "RowKey": token,
                **entity,
            })
            return entity
        except Exception as e:
            logger.warning("create_link: %s", e)
            raise
    _in_memory[token] = entity
    return entity


def _entity_to_dict(e: dict) -> dict:
    return {
        "token": e.get("token") or e.get("RowKey"),
        "resident_id": e.get("resident_id"),
        "facility_id": e.get("facility_id"),
        "generated_by": e.get("generated_by"),
        "expires_at": e.get("expires_at"),
        "valid_for_date": e.get("valid_for_date"),
        "used": e.get("used", False),
        "used_at": e.get("used_at"),
        "created_at": e.get("created_at"),
        "is_persistent": bool(e.get("is_persistent", False)),
    }


def create_persistent_link(
    resident_id: str,
    facility_id: str = "default",
    generated_by: str = "system",
) -> dict:
    """Create the resident's permanent recording link, or return the
    existing one if it already exists. One row per resident.

    The token never expires and never gets marked used; the resident
    reuses the same URL every day for their daily check-in.
    """
    existing = get_persistent_link_for_resident(resident_id)
    if existing is not None:
        return existing

    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    entity = {
        "token": token,
        "resident_id": resident_id,
        "facility_id": facility_id,
        "generated_by": generated_by,
        "expires_at": _FAR_FUTURE,
        "valid_for_date": date.today().isoformat(),  # informational only
        "used": False,
        "used_at": None,
        "created_at": now,
        "is_persistent": True,
    }
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": "link",
                "RowKey": token,
                **entity,
            })
            return entity
        except Exception as e:
            logger.warning("create_persistent_link: %s", e)
            raise
    _in_memory[token] = entity
    return entity


def get_persistent_link_for_resident(resident_id: str) -> dict | None:
    """Return the resident's persistent link row, or None if not yet created."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=(
                    f"PartitionKey eq 'link' and resident_id eq '{resident_id}' "
                    f"and is_persistent eq true"
                )
            ))
            if not entities:
                return None
            entities.sort(key=lambda e: e.get("created_at") or "", reverse=True)
            return _entity_to_dict(entities[0])
        except Exception as ex:
            logger.warning("get_persistent_link_for_resident: %s", ex)
            return None
    matches = [
        v for v in _in_memory.values()
        if v.get("resident_id") == resident_id and v.get("is_persistent")
    ]
    if not matches:
        return None
    matches.sort(key=lambda v: v.get("created_at") or "", reverse=True)
    return _entity_to_dict(matches[0])


def get_link(token: str) -> dict | None:
    """Retrieve a link by token."""
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key="link", row_key=token)
            return _entity_to_dict(e)
        except Exception:
            return None
    link = _in_memory.get(token)
    return _entity_to_dict(link) if link else None


def get_link_by_resident_and_date(resident_id: str, valid_for_date: str) -> dict | None:
    """Idempotency lookup: find an existing link for (resident_id, date).

    Returns the most-recently-created link if multiple exist, or None.
    """
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=(
                    f"PartitionKey eq 'link' and resident_id eq '{resident_id}' "
                    f"and valid_for_date eq '{valid_for_date}'"
                )
            ))
            if not entities:
                return None
            entities.sort(key=lambda e: e.get("created_at") or "", reverse=True)
            return _entity_to_dict(entities[0])
        except Exception as ex:
            logger.warning("get_link_by_resident_and_date: %s", ex)
            return None
    matches = [
        v for v in _in_memory.values()
        if v.get("resident_id") == resident_id
        and v.get("valid_for_date") == valid_for_date
    ]
    if not matches:
        return None
    matches.sort(key=lambda v: v.get("created_at") or "", reverse=True)
    return _entity_to_dict(matches[0])


def mark_used(token: str) -> bool:
    """Mark a link as used. Returns True if updated."""
    now = datetime.now(timezone.utc).isoformat()
    table = _get_table()
    if table:
        try:
            e = table.get_entity(partition_key="link", row_key=token)
            e["used"] = True
            e["used_at"] = now
            table.upsert_entity(e)
            return True
        except Exception:
            return False
    link = _in_memory.get(token)
    if link:
        link["used"] = True
        link["used_at"] = now
        return True
    return False


def list_by_nurse(generated_by: str) -> list[dict]:
    """List all links generated by a specific nurse."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"PartitionKey eq 'link' and generated_by eq '{generated_by}'"
            ))
            return [
                {
                    "token": e.get("token") or e["RowKey"],
                    "resident_id": e.get("resident_id"),
                    "facility_id": e.get("facility_id"),
                    "expires_at": e.get("expires_at"),
                    "used": e.get("used", False),
                    "created_at": e.get("created_at"),
                }
                for e in entities
            ]
        except Exception as e:
            logger.warning("list_by_nurse: %s", e)
            return []
    return [v for v in _in_memory.values() if v.get("generated_by") == generated_by]


def list_all() -> list[dict]:
    """List all links (dev/admin fallback)."""
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(query_filter="PartitionKey eq 'link'"))
            return [
                {
                    "token": e.get("token") or e["RowKey"],
                    "resident_id": e.get("resident_id"),
                    "facility_id": e.get("facility_id"),
                    "expires_at": e.get("expires_at"),
                    "used": e.get("used", False),
                    "created_at": e.get("created_at"),
                }
                for e in entities
            ]
        except Exception as ex:
            logger.warning("list_all: %s", ex)
            return []
    return list(_in_memory.values())
