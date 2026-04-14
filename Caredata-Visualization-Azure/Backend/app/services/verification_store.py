"""
Verification token store: Azure Table Storage or in-memory fallback.
Stores email verification tokens with expiry.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "verificationtokens"
TOKEN_EXPIRY_HOURS = 24

_in_memory_tokens: dict[str, dict] = {}  # token -> {email, expires_at, used}


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
        logger.warning("verification_store _get_table: %s", e)
        return None


def create_token(email: str) -> str:
    """Generate a verification token for an email. Returns the token string."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    table = _get_table()
    if table:
        try:
            table.upsert_entity({
                "PartitionKey": "verification",
                "RowKey": token,
                "email": email.lower().strip(),
                "expires_at": expires_at.isoformat(),
                "used": False,
            })
        except Exception as e:
            logger.exception("verification_store create_token: %s", e)
            raise
    else:
        _in_memory_tokens[token] = {
            "email": email.lower().strip(),
            "expires_at": expires_at,
            "used": False,
        }
    return token


def verify_token(token: str) -> str | None:
    """Verify a token. Returns the email if valid and unused, else None. Marks as used."""
    table = _get_table()
    if table:
        try:
            entity = table.get_entity(partition_key="verification", row_key=token)
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
            logger.warning("verification_store verify_token: %s", e)
            return None
    else:
        data = _in_memory_tokens.get(token)
        if not data or data["used"]:
            return None
        if datetime.now(timezone.utc) > data["expires_at"]:
            return None
        data["used"] = True
        return data["email"]


def delete_tokens_for_email(email: str):
    """Delete all tokens for an email (cleanup after verification)."""
    email = email.lower().strip()
    table = _get_table()
    if table:
        try:
            entities = list(table.query_entities(
                query_filter=f"email eq '{email}'"
            ))
            for e in entities:
                table.delete_entity(e["PartitionKey"], e["RowKey"])
        except Exception as ex:
            logger.warning("verification_store delete_tokens: %s", ex)
    else:
        to_remove = [t for t, d in _in_memory_tokens.items() if d["email"] == email]
        for t in to_remove:
            del _in_memory_tokens[t]
