from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/users", tags=["Users"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.get("/me")
def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
  try:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    username: str = payload.get("sub")
    if username is None:
      raise HTTPException(status_code=401, detail="Invalid token")
  except JWTError:
    raise HTTPException(status_code=401, detail="Invalid token")

  user = db.query(User).filter(User.username == username).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  return {"username": user.username, "email": user.email}
