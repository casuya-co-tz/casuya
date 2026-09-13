"""Casuya Audio-TTS microservice configuration.

Mirrors `apps/payments/app/config.py`. The engine + voice models are cloned
from GitHub (`rhasspy/piper-voices`, Kiswahili `sw` + English) at Docker
build time; at runtime this service only needs the model path + API key.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "casuya-audio-tts"
    environment: str = "production"
    port: int = 8010

    # Internal API key required by every endpoint; the platform backend sends it
    # as X-API-Key. When unset the endpoints stay open in dev; production MUST
    # set it (same policy as apps/payments).
    api_key: str | None = None

    # Lageni (engine) + sauti (voice) sourced from GitHub at build time.
    # piper_http_url: internal HTTP server URL (defaults to own host).
    piper_http_url: str = "http://127.0.0.1:5001"
    # Voice model(s) baked into the image at build: Kiswahili (sw) + English (en).
    piper_voice_sw: str = "sw_ZA-isiNdebele-medium"  # placeholder - verify sw voice
    piper_voice_en: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
