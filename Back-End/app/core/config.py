from pydantic_settings import BaseSettings

class Settings(BaseSettings):
  DATABASE_URL: str = "postgresql://caredata_user:123456789@localhost/caredata_db"
  SECRET_KEY: str = "your_secret_key"
  ALGORITHM: str = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings()
