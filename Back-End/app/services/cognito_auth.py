"""
Verify AWS Cognito JWT (id_token) and return claims.
No PostgreSQL required; user identity comes from Cognito.
"""
from fastapi import Depends, HTTPException
from fastapi import status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from jose.utils import base64url_decode
import urllib.request
import json
from functools import lru_cache

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def _get_cognito_jwks():
    """Fetch Cognito JWKS (public keys) for your User Pool."""
    if not settings.COGNITO_USER_POOL_ID or not settings.COGNITO_REGION:
        return None
    url = (
        f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/"
        f"{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    with urllib.request.urlopen(url, timeout=5) as res:
        return json.loads(res.read().decode())


@lru_cache(maxsize=1)
def _get_jwks_cached():
    """Cached JWKS so we don't fetch on every request."""
    return _get_cognito_jwks()


def verify_cognito_token(token: str) -> dict:
    """
    Verify Cognito id_token and return payload (sub, email, given_name, etc.).
    Raises HTTPException if invalid.
    """
    if not settings.COGNITO_USER_POOL_ID or not settings.COGNITO_REGION:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cognito not configured",
        )
    try:
        jwks = _get_jwks_cached()
        if not jwks:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not load Cognito keys",
            )
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.COGNITO_APP_CLIENT_ID,
            options={"verify_exp": True, "verify_at_hash": False},
        )
        return payload
    except JWTError as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("JWT verification failed: %s (token preview: %s...)", str(e), token[:50] if token else "None")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_cognito(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Dependency: validate Cognito Bearer token and return a user-like dict
    (id=sub, email, first_name, last_name) for use in /auth/me and other routes.
    """
    if not credentials:
        import logging
        logging.getLogger(__name__).warning("get_current_user_cognito: no credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    import logging
    logging.getLogger(__name__).debug("get_current_user_cognito: verifying token (preview: %s...)", credentials.credentials[:50] if credentials.credentials else "None")
    payload = verify_cognito_token(credentials.credentials)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    return {
        "id": sub,
        "sub": sub,
        "email": payload.get("email") or payload.get("cognito:username") or "",
        "first_name": payload.get("given_name") or "User",
        "last_name": payload.get("family_name") or "",
        "token_claims": payload,
    }
