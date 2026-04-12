from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

BACKEND_ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    PROJECT_NAME: str = "Video Lecture to Somali Notes"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    ALGORITHM: str = "HS256"
    GEMINI_API_KEY: str = ""
    GEMINI_TRANSCRIPTION_MODEL: str = "gemini-2.5-flash-lite"
    GEMMA_MODEL: str = "gemma-4-31b-it"
    FFMPEG_BINARY: Optional[str] = None
    FFPROBE_BINARY: Optional[str] = None

    class Config:
        env_file = str(BACKEND_ROOT / ".env")
        extra = "ignore"

settings = Settings()

def load_settings() -> Settings:
    return Settings()
