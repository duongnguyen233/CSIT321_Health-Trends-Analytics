from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file when this module is imported
load_dotenv()

class Settings(BaseSettings):
  DATABASE_URL: str
  SECRET_KEY: str = "your_secret_key"
  ALGORITHM: str = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

  class Config:
    env_file = ".env"
    env_file_encoding = "utf-8"

settings = Settings()
