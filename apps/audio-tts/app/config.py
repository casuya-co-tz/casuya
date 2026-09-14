"""Casuya Audio-TTS microservice configuration.

Mirrors `apps/payments/app/config.py` and `apps/audio-stt/app/config.py`. The
Sherpa-ONNX TTS engine (PyPI wheel) + Kiswahili (`sw`) and English (`en`) VITS
voice packs are baked into the image at Docker build time (see the Dockerfile);
at runtime this service only needs the model directory + API key.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "casuya-audio-tts"
    environment: str = "production"
    port: int = 8010

    # Internal API key required by the TTS endpoint; the platform backend sends
    # it as X-API-Key. When unset the endpoint stays open in dev (payments policy).
    api_key: str | None = None

    # Voices baked at build time under this directory (see the Dockerfile).
    # Each voice pack is a folder named `vits-piper-<lang>-<name>-<quality>`
    # containing `<lang>.onnx`, `tokens.txt`, and `espeak-ng-data/`.
    sherpa_models_dir: str = "/opt/sherpa-onnx-tts/models"


@lru_cache
def get_settings() -> Settings:
    return Settings()
