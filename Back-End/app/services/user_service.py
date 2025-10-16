from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password, verify_password


def create_user(db: Session, first_name: str, last_name: str, email: str, password: str):
  hashed_pw = hash_password(password)
  user = User(
    first_name=first_name,
    last_name=last_name,
    email=email,
    hashed_password=hashed_pw
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
