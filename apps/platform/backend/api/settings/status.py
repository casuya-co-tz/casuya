"""Platform information / environment-variable health status.

Reports the configured/healthy status of every backend setting (drawn from
environment variables) plus live runtime checks (database, redis, SMTP).
Secret values are never returned in full — only masked summaries."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from sqlalchemy import text

from backend.config.database import get_engine, redis_client
from backend.config.settings import get_settings
from backend.middleware.permissions import require_role
from backend.services.email_service import smtp_configured

router = APIRouter(tags=["settings"])

_ENV_META = {
    # name -> (label, group, secret)
    "app_name": ("App Name", "Core", False),
    "environment": ("Environment", "Core", False),
    "debug": ("Debug Mode", "Core", False),
    "database_url": ("Database URL", "Database", True),
    "database_replica_url": ("Database Replica URL", "Database", True),
    "redis_url": ("Redis URL", "Redis", True),
    "jwt_secret": ("JWT Secret", "Auth", True),
    "jwt_algorithm": ("JWT Algorithm", "Auth", False),
    "access_token_expire_minutes": ("Access Token Expiry (min)", "Auth", False),
    "refresh_token_expire_days": ("Refresh Token Expiry (days)", "Auth", False),
    "allowed_origins": ("Allowed Origins", "CORS", False),
    "cors_origin_regex": ("CORS Origin Regex", "CORS", False),
    "casuya_core_signing_key": ("Core Signing Key", "Integrations", True),
    "casuya_ai_url": ("AI Service URL", "Integrations", False),
    "casuya_bridge_shared_key": ("Bridge Shared Key", "Integrations", True),
    "supabase_url": ("Supabase URL", "Integrations", False),
    "supabase_key": ("Supabase Key", "Integrations", True),
    "cloudflare_zone_id": ("Cloudflare Zone ID", "Integrations", False),
    "cloudflare_api_token": ("Cloudflare API Token", "Integrations", True),
    "azampay_client_id": ("AzamPay Client ID", "Payments", False),
    "azampay_client_secret": ("AzamPay Client Secret", "Payments", True),
    "azampay_app_name": ("AzamPay App Name", "Payments", False),
    "azampay_x_api_key": ("AzamPay X-API-Key", "Payments", True),
    "azampay_sandbox": ("AzamPay Sandbox", "Payments", False),
    "azampay_mock": ("AzamPay Mock Mode", "Payments", False),
    "africastalking_username": ("Africa's Talking Username", "SMS", False),
    "africastalking_api_key": ("Africa's Talking API Key", "SMS", True),
    "casuya_payments_url": ("Payments Service URL", "Microservices", False),
    "casuya_services_bridge_url": ("Services Bridge URL", "Microservices", False),
    "casuya_api_url": ("API Gateway URL", "Microservices", False),
    "casuya_orchestrator_health_url": ("Orchestrator Health URL", "Microservices", False),
    "sentry_dsn": ("Sentry DSN", "Observability", True),
    "google_client_id": ("Google Client ID", "OAuth", False),
    "google_client_secret": ("Google Client Secret", "OAuth", True),
    "facebook_client_id": ("Facebook Client ID", "OAuth", False),
    "facebook_client_secret": ("Facebook Client Secret", "OAuth", True),
    "oauth_redirect_base": ("OAuth Redirect Base", "OAuth", False),
    "frontend_base": ("Frontend Base URL", "OAuth", False),
    "storage_root": ("Storage Root", "Files", False),
    "rate_limit_per_minute": ("Rate Limit (per min)", "Security", False),
    "smtp_host": ("SMTP Host", "Email", False),
    "smtp_port": ("SMTP Port", "Email", False),
    "smtp_user": ("SMTP User", "Email", False),
    "smtp_password": ("SMTP Password", "Email", True),
    "brevo_api_key": ("Brevo API Key", "Email", True),
    "email_from": ("Email From", "Email", False),
    "email_from_name": ("Email From Name", "Email", False),
    "frontend_reset_url": ("Password Reset URL", "Email", False),
}


def _mask(value, secret: bool) -> str:
    """Return a safe display value, masking secrets and truncating long values."""
    if value is None:
        return ""
    s = str(value)
    if secret:
        if not s:
            return ""
        return s[:3] + "••••" + s[-3:] if len(s) > 6 else "••••"
    if len(s) > 64:
        return s[:61] + "..."
    return s


def _configured(value) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, dict)):
        return bool(value)
    return str(value).strip() != ""


def _env_var_name(field: str) -> str:
    return field.upper()


def _backend_status() -> dict:
    settings = get_settings()
    explicit = {
        k: _env_var_name(k) in os.environ
        for k in settings.model_dump().keys()
    }
    variables = []
    for field, value in settings.model_dump().items():
        label, group, secret = _ENV_META.get(
            field, (field.replace("_", " ").title(), "Other", False)
        )
        variables.append({
            "name": _env_var_name(field),
            "label": label,
            "group": group,
            "secret": secret,
            "configured": _configured(value),
            "source": "env" if explicit.get(field) else "default",
            "value": _mask(value, secret),
        })
    variables.sort(key=lambda v: (v["group"], v["label"]))
    return variables


def _runtime_status() -> dict:
    db_ok = False
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    redis_ok = False
    try:
        redis_ok = redis_client.ping()
    except Exception:
        pass

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "database": db_ok,
        "redis": redis_ok,
        "smtp": smtp_configured(),
    }


@router.get("/platform-status")
def get_platform_status(_admin=Depends(require_role("admin"))):
    """Admin-only health status of all backend environment variables and runtime."""
    st = get_settings()
    return {
        "environment": st.environment,
        "debug": st.debug,
        "runtime": _runtime_status(),
        "backend": _backend_status(),
    }
