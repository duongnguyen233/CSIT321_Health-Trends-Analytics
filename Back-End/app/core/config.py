from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # AWS Cognito (required for auth)
    COGNITO_USER_POOL_ID: str | None = None
    COGNITO_REGION: str | None = None
    COGNITO_APP_CLIENT_ID: str | None = None
    OPENAI_API_KEY: str | None = None  # For Health Scan (ChatGPT Vision)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # ignore old DATABASE_URL, SECRET_KEY, etc. in .env


settings = Settings()
