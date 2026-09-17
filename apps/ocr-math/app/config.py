"""Casuya Math OCR microservice config.

Mirrors `apps/audio-stt/app/config.py` and `apps/audio-tts/app/config.py`.
The Pix2Text engine is installed from a PyPI wheel at Docker build time; at
runtime this service only needs the API key and — when used — a model
directory override.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "casuya-ocr-math"
    environment: str = "production"
    port: int = 8030

    # Internal API key required by the recognize endpoint; the platform backend
    # sends it as X-API-Key. Unset in dev keeps endpoints open (payments policy).
    api_key: str | None = None

    # Directory the Dockerfile bakes the OCR models into (empty = Pix2Text
    # downloads its default models into ~/.pix2text on first use, or uses the
    # bundled model). Override to point at a pre-baked model dir.
    ocr_models_dir: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
