from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env variables
load_dotenv()

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "your_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Add missing fields
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    # For Google Login
    GOOGLE_CLIENT_ID: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
