"""
User store for Azure: Azure Table Storage or in-memory fallback for dev.
Used by /auth/register and /auth/login; keyed by email.
"""
import json
import logging
import os
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory store when Azure is not configured (dev)
_in_memory_users: dict[str, dict] = {}  # email -> user dict


def _get_table_client():
    """Return Azure Table Storage table client if configured, else None."""
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        table = client.get_table_client(table_name="users")
        return table
    except Exception as e:
        logger.warning("Azure Table Storage not available: %s", e)
        return None


def get_user_by_email(email: str) -> dict | None:
    """Get user by email. Returns None if not found."""
    email = (email or "").strip().lower()
    if not email:
        return None
    table = _get_table_client()
    if table:
        try:
            entity = table.get_entity(partition_key="user", row_key=email)
            return {
                "id": entity.get("user_id"),
                "email": entity.get("email", ""),
                "password_hash": entity.get("password_hash", ""),
                "first_name": entity.get("first_name", ""),
                "last_name": entity.get("last_name", ""),
                "role": entity.get("role", "user"),
                "email_verified": entity.get("email_verified", False),
            }
        except Exception as e:
            if "ResourceNotFound" in str(type(e).__name__) or "404" in str(e):
                return None
            logger.warning("user_store get_user_by_email: %s", e)
            return None
    return _in_memory_users.get(email)


def get_user_by_id(user_id: str) -> dict | None:
    """Get user by id (for /auth/me)."""
    if not user_id:
        return None
    # Escape single quotes for OData filter
    safe_id = (user_id or "").replace("'", "''")
    table = _get_table_client()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"user_id eq '{safe_id}'"
            ))
            if not entities:
                return None
            e = entities[0]
            return {
                "id": e.get("user_id"),
                "email": e.get("email", ""),
                "first_name": e.get("first_name", ""),
                "last_name": e.get("last_name", ""),
                "role": e.get("role", "user"),
            }
        except Exception as e:
            logger.warning("user_store get_user_by_id: %s", e)
            return None
    for u in _in_memory_users.values():
        if u.get("id") == user_id:
            return {k: v for k, v in u.items() if k != "password_hash"}
    return None


def _ensure_table():
    """Create Azure table if it does not exist."""
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.data.tables import TableServiceClient
        client = TableServiceClient.from_connection_string(conn)
        try:
            client.create_table("users")
        except Exception as create_err:
            if "TableAlreadyExists" not in str(create_err) and "409" not in str(create_err):
                raise create_err
        return client.get_table_client("users")
    except Exception as e:
        logger.warning("Azure Table Storage ensure_table: %s", e)
        return None


def create_user(email: str, password_hash: str, first_name: str = "", last_name: str = "") -> dict:
    """Create user. Raises if email already exists. Returns user dict (no password_hash)."""
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("Email is required")
    if get_user_by_email(email):
        raise ValueError("Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": email,
        "first_name": (first_name or "").strip(),
        "last_name": (last_name or "").strip(),
        "role": "user",
    }
    # Ensure table exists before inserting (create if missing)
    table = _ensure_table() or _get_table_client()
    if table:
        try:
            table.create_entity({
                "PartitionKey": "user",
                "RowKey": email,
                "user_id": user_id,
                "email": email,
                "password_hash": password_hash,
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "role": "user",
                "email_verified": False,
            })
        except Exception as e:
            logger.exception("user_store create_user: %s", e)
            raise
    else:
        _in_memory_users[email] = {
            **user,
            "password_hash": password_hash,
            "email_verified": False,
        }
    return user


def mark_email_verified(email: str) -> bool:
    """Mark a user's email as verified. Returns True on success."""
    email = (email or "").strip().lower()
    if not email:
        return False
    table = _get_table_client()
    if table:
        try:
            entity = table.get_entity(partition_key="user", row_key=email)
            entity["email_verified"] = True
            table.upsert_entity(entity)
            return True
        except Exception as e:
            logger.warning("user_store mark_email_verified: %s", e)
            return False
    else:
        user = _in_memory_users.get(email)
        if user:
            user["email_verified"] = True
            return True
        return False
