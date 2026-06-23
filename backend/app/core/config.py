"""
EVAC Congestion System — Application Configuration
===================================================
Centralised settings loaded from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from env vars / .env file."""

    APP_NAME: str = "EVAC Congestion System API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Paths — resolve relative to the project root
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent.parent
    ML_ROOT: Path = PROJECT_ROOT / "EVAC_Congestion_System-main (1)" / "EVAC_Congestion_System-main"
    MODEL_DIR: Path = ML_ROOT / "ml" / "models"
    DATA_DIR: Path = ML_ROOT / "data"
    CSV_FILENAME: str = "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
