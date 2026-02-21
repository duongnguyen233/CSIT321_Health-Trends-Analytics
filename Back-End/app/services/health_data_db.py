"""
Store and retrieve My Data (health scan text) per user in DynamoDB.
Keyed by Cognito sub. Text only; no images (cost-effective).
"""
import os
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("HEALTH_DATA_TABLE_NAME", "CareDataHealthData-dev")


def _get_table():
    return boto3.resource("dynamodb").Table(TABLE_NAME)


def _to_json_friendly(obj):
    """Convert DynamoDB types (e.g. Decimal) to JSON-serializable types."""
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _to_json_friendly(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_friendly(v) for v in obj]
    return obj


def get_health_data(sub: str) -> dict | None:
    """Get stored health data for user. Returns None if not found."""
    try:
        r = _get_table().get_item(Key={"sub": sub})
        item = r.get("Item")
        if not item:
            return None
        return {
            "patient": _to_json_friendly(item.get("patient") or {}),
            "clinical": _to_json_friendly(item.get("clinical") or {}),
            "trend": _to_json_friendly(item.get("trend") or {}),
        }
    except ClientError:
        return None


def put_health_data(sub: str, patient: dict, clinical: dict, trend: dict) -> None:
    """Save health data for user. Overwrites existing."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        _get_table().put_item(
            Item={
                "sub": sub,
                "patient": patient,
                "clinical": clinical,
                "trend": trend,
                "updated_at": now,
            }
        )
    except ClientError as e:
        import logging
        logging.getLogger(__name__).warning("DynamoDB put_health_data failed: %s", e)
        raise
