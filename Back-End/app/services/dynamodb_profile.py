"""
DynamoDB-backed user profile (optional). Use when running serverless;
profiles keyed by Cognito sub. No PostgreSQL.
"""
import os
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("PROFILES_TABLE_NAME", "CareDataProfiles")


def _get_table():
    return boto3.resource("dynamodb").Table(TABLE_NAME)


def get_profile(sub: str) -> dict | None:
    """Get user profile by Cognito sub."""
    try:
        r = _get_table().get_item(Key={"sub": sub})
        return r.get("Item")
    except ClientError:
        return None


def put_profile(sub: str, first_name: str, last_name: str, email: str, role: str = "user"):
    """Create or update profile (e.g. after first login)."""
    try:
        _get_table().put_item(
            Item={
                "sub": sub,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "role": role,
            }
        )
    except ClientError as e:
        # Log but don't crash - caller can still return Cognito claims
        import logging
        logging.getLogger(__name__).warning("DynamoDB put_profile failed: %s", e)
        raise


def get_or_create_profile(user_claims: dict) -> dict:
    """
    Return profile from DynamoDB; if missing, create from Cognito claims and return.
    If DynamoDB is unavailable, returns user from Cognito claims only (avoids 500).
    """
    sub = user_claims.get("sub")
    if not sub:
        return user_claims
    first = user_claims.get("first_name") or user_claims.get("given_name") or "User"
    last = user_claims.get("last_name") or user_claims.get("family_name") or ""
    email = user_claims.get("email") or ""
    fallback = {
        "id": sub,
        "first_name": first,
        "last_name": last,
        "email": email,
        "role": "user",
    }
    try:
        profile = get_profile(sub)
        if profile:
            return {
                "id": profile["sub"],
                "first_name": profile.get("first_name", "User"),
                "last_name": profile.get("last_name", ""),
                "email": profile.get("email", ""),
                "role": profile.get("role", "user"),
            }
        put_profile(sub, first, last, email, "user")
        return fallback
    except Exception:
        # DynamoDB error or any other failure - return Cognito claims so login still works
        return fallback
