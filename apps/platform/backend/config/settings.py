"""Application settings, loaded from environment variables (.env in dev)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_allowed_origins(v):
    if v is None:
        return v
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return []
        # Try JSON first: '["https://a","https://b"]'
        if s.startswith("["):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            except Exception:
                pass
        # Fallback: comma-separated: 'https://a,https://b'
        return [x.strip() for x in s.split(",") if x.strip()]
    return v


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Casuya Platform"
    environment: str = "development"  # development | staging | production
    debug: bool = True

    database_url: str = "postgresql://postgres:postgres@localhost:5432/casuya_platform"
    redis_url: str = "redis://localhost:6379"

    jwt_secret: str = "insecure-development-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    allowed_origins: Annotated[list[str], BeforeValidator(_parse_allowed_origins)] = [
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "https://casuya-backend.onrender.com",
        "https://casuya.co.tz",
        "https://www.casuya.co.tz",
    ]

    cors_origin_regex: str | None = (
        r"https://([a-z0-9-]+\.)*casuya\.co\.tz|https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1):[0-9]+"
    )

    casuya_core_signing_key: str | None = None
    casuya_ai_url: str = "http://localhost:3000"
    casuya_bridge_shared_key: str | None = None
    supabase_url: str | None = None
    supabase_key: str | None = None
    cloudflare_zone_id: str | None = None
    cloudflare_api_token: str | None = None
    azampay_client_id: str | None = None
    azampay_client_secret: str | None = None
    africastalking_username: str | None = None
    africastalking_api_key: str | None = None

    # Casuya Payments microservice
    casuya_payments_url: str = "http://localhost:3002"

    # Casuya Services Bridge microservice (content, exams, media, auth, analytics, search)
    casuya_services_bridge_url: str = "http://localhost:3003"

    # Casuya API gateway (blackboard exam/math endpoints, etc.)
    casuya_api_url: str = "http://localhost:8081"

    # Casuya Orchestrator (standalone automation/maintenance tool). Optional; when set,
    # the platform polls this URL for a health signal. Leave empty if not deployed.
    casuya_orchestrator_health_url: str | None = None

    sentry_dsn: str | None = None

    # OAuth providers
    google_client_id: str | None = None
    google_client_secret: str | None = None
    facebook_client_id: str | None = None
    facebook_client_secret: str | None = None
    oauth_redirect_base: str = "https://casuya.co.tz"
    frontend_base: str = "http://localhost:5173"

    storage_root: str = "./storage"
    rate_limit_per_minute: int = 120


@lru_cache
def get_settings() -> Settings:
    return Settings()
