"""Casuya Audio-STT microservice config.

Mirrors `apps/audio-tts/app/config.py`. The Sherpa-ONNX Whisper model
(Kiswahili `sw` + English) is baked into the image at Docker build time; at
runtime this service only needs the model path + API key.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "casuya-audio-stt"
    environment: str = "production"
    port: int = 8020

    # Internal API key required by the transcribe endpoint; the platform backend
    # sends it as X-API-Key. Unset in dev keeps endpoints open (payments policy).
    api_key: str | None = None

    # Directory the Dockerfile bakes the Whisper model files into.
    asr_models_dir: str = "/opt/sherpa-onnx-models"

    # Whisper size baked at build time: `base` (~150 MB) or `small` (~610 MB).
    # Small improves WER on classroom Kiswahili/English at ~2× CPU/RAM.
    whisper_model: str = "small"


@lru_cache
def get_settings() -> Settings:
    return Settings()
