"""
Password reset token store: Azure Table Storage or in-memory fallback.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "passwordresettokens"
TOKEN_EXPIRY_HOURS = 1

_in_memory_tokens: dict[str, dict] = {}


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
        logger.warning("password_reset_store _get_table: %s", e)
        return None


def create_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    email = email.lower().strip()
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": "password_reset",
                "RowKey": token,
                "email": email,
                "expires_at": expires_at.isoformat(),
                "used": False,
            })
        except Exception as e:
            logger.warning("password_reset_store Azure fallback in-memory: %s", e)
            _in_memory_tokens[token] = {"email": email, "expires_at": expires_at, "used": False}
    else:
        _in_memory_tokens[token] = {"email": email, "expires_at": expires_at, "used": False}
    return token


def consume_token(token: str) -> str | None:
    """Return email if token is valid and unused; mark as used."""
    table = _get_table()
    if table:
        try:
            entity = table.get_entity(partition_key="password_reset", row_key=token)
            if entity.get("used"):
                return None
            expires_at = datetime.fromisoformat(entity["expires_at"])
            if datetime.now(timezone.utc) > expires_at:
                return None
            entity["used"] = True
            table.upsert_entity(entity)
            return entity["email"]
        except Exception as e:
            if "ResourceNotFound" in str(type(e).__name__) or "404" in str(e):
                return None
            logger.warning("password_reset_store consume_token: %s", e)
            return None
    data = _in_memory_tokens.get(token)
    if not data or data["used"]:
        return None
    if datetime.now(timezone.utc) > data["expires_at"]:
        return None
    data["used"] = True
    return data["email"]
