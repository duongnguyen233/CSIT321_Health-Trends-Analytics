from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services import user_service
from app.models.user import User
from app.core.security import create_access_token
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
def register_user(data: dict, db: Session = Depends(get_db)):
  required_fields = ["first_name", "last_name", "email", "password"]
  for field in required_fields:
    if field not in data:
      raise HTTPException(status_code=400, detail=f"Missing field: {field}")

  existing_user = db.query(User).filter(User.email == data["email"]).first()
  if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")

  user = user_service.create_user(
    db,
    first_name=data["first_name"],
    last_name=data["last_name"],
    email=data["email"],
    password=data["password"],
  )
  return {"message": "User registered successfully", "email": user.email}


@router.post("/login")
def login_user(data: dict, db: Session = Depends(get_db)):
  email = data.get("email")
  password = data.get("password")

  user = user_service.authenticate_user(db, email, password)
  if not user:
    raise HTTPException(status_code=401, detail="Invalid email or password")

  access_token = create_access_token({"sub": user.email})
  return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def get_user_me(current_user: User = Depends(get_current_user)):
    """Return the logged-in user's info."""
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
    }