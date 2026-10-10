import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "JalRakshak API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jalrakshak.db")
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.10
    DEFAULT_IOU_THRESHOLD: float = 0.45
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    SAMPLES_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_feeds")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
