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
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMMA_MODEL: str = "gemini-2.5-flash"
    YOUTUBE_MAX_DURATION_MINUTES: int = 0
    YOUTUBE_COOKIES_FROM_BROWSER: str = ""
    YOUTUBE_COOKIE_FILE: str = ""
    TRANSCRIPTION_CHUNK_SECONDS: int = 8 * 60
    TRANSCRIPTION_MIN_CHUNK_SECONDS: int = 2 * 60
    TRANSCRIPTION_MAX_RETRIES: int = 3
    AI_PROVIDER_RETRY_ATTEMPTS: int = 2
    AI_PROVIDER_RETRY_BASE_SECONDS: float = 0.5
    AI_PROVIDER_RETRY_MAX_SECONDS: float = 10.0
    GEMINI_FILE_READY_TIMEOUT_SECONDS: int = 180
    NOTES_TRANSCRIPT_CHUNK_CHAR_LIMIT: int = 18000
    FFMPEG_BINARY: Optional[str] = None
    FFPROBE_BINARY: Optional[str] = None

    class Config:
        env_file = str(BACKEND_ROOT / ".env")
        extra = "ignore"

settings = Settings()

def load_settings() -> Settings:
    return Settings()
