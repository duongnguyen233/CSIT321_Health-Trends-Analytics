from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services import user_service
from app.models.user import User
from app.core.security import create_access_token, hash_password
from app.services.auth_service import get_current_user, verify_google_id_token

import secrets

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------- Pydantic Schemas ----------

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    # frontend may send either "credential" or "id_token"
    credential: str | None = None
    id_token: str | None = None


# ---------- Email / Password Register ----------

@router.post("/register")
def register_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = user_service.create_user(
        db,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        password=data.password,
    )

    # You don't strictly need to return a token here, but it's fine:
    access_token = create_access_token({"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        },
    }


# ---------- Email / Password Login ----------

@router.post("/login")
def login_user(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = user_service.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token({"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ---------- Google Login ----------

@router.post("/google")
def google_login(
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    token = payload.credential or payload.id_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google token",
        )

    idinfo = verify_google_id_token(token)

    email: str | None = idinfo.get("email")
    first_name: str = idinfo.get("given_name") or "Google"
    last_name: str = idinfo.get("family_name") or "User"

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email",
        )

    user = db.query(User).filter(User.email == email).first()

    # Create user if not exist
    if not user:
        random_pw = secrets.token_hex(16)
        user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            hashed_password=hash_password(random_pw),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        },
    }


# ---------- Me ----------

@router.get("/me")
def get_user_me(current_user: User = Depends(get_current_user)):
    """Return the logged-in user's info."""
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
    }
