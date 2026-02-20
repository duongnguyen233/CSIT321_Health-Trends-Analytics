"""
Auth: Cognito + DynamoDB only. No PostgreSQL.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.services.cognito_auth import get_current_user_cognito, security
from app.services import dynamodb_profile
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/debug-token")
def debug_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    """Debug endpoint to check token without full verification."""
    from app.services.cognito_auth import security
    from jose import jwt
    if not credentials:
        return {"error": "No token provided"}
    token = credentials.credentials
    try:
        unverified = jwt.get_unverified_claims(token)
        return {
            "has_token": True,
            "unverified_claims": unverified,
            "audience": unverified.get("aud"),
            "expected_audience": settings.COGNITO_APP_CLIENT_ID,
            "matches": unverified.get("aud") == settings.COGNITO_APP_CLIENT_ID,
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/me")
def get_user_me(current_user: dict = Depends(get_current_user_cognito)):
    """Return the logged-in user's info from Cognito + DynamoDB profile."""
    try:
        profile = dynamodb_profile.get_or_create_profile(current_user)
        return {
            "id": profile.get("id") or current_user.get("sub"),
            "first_name": profile.get("first_name", "User"),
            "last_name": profile.get("last_name", ""),
            "email": profile.get("email", ""),
            "role": profile.get("role", "user"),
        }
    except Exception as e:
        # Fallback: return from token only so login never 500s
        import logging
        logging.getLogger(__name__).exception("get_or_create_profile failed: %s", e)
        return {
            "id": current_user.get("sub"),
            "first_name": current_user.get("first_name") or current_user.get("given_name") or "User",
            "last_name": current_user.get("last_name") or current_user.get("family_name") or "",
            "email": current_user.get("email", ""),
            "role": "user",
        }


@router.post("/register")
def register_disabled():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use Cognito sign-up (frontend: Amplify Auth.signUp or Hosted UI).",
    )


@router.post("/login")
def login_disabled():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use Cognito sign-in (frontend: Amplify Auth.signIn or Hosted UI).",
    )


@router.post("/google")
def google_disabled():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use Cognito Google sign-in (frontend: Hosted UI or federatedSignIn).",
    )
