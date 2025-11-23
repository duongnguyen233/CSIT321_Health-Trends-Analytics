from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password, verify_password
import secrets


def create_user(db: Session, first_name: str, last_name: str, email: str, password: str, role: str = "user"):
    hashed_pw = hash_password(password)
    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        hashed_password=hashed_pw,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_or_create_google_user(
    db: Session,
    *,
    email: str,
    first_name: str,
    last_name: str,
    google_sub: str,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        # If user already exists but has no google_sub, set it
        if user.google_sub is None:
            user.google_sub = google_sub
            db.commit()
            db.refresh(user)
        return user

    # Create a random password, since login goes through Google
    random_password = secrets.token_urlsafe(16)
    hashed_pw = hash_password(random_password)

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        hashed_password=hashed_pw,
        role="user",
        google_sub=google_sub,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
