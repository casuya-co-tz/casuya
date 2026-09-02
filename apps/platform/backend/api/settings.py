"""Module visibility settings — lets admins toggle which sidebar modules
are shown to students and teachers."""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config.database import get_db, get_engine, redis_client
from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.setting import Setting
from backend.services.email_service import smtp_configured

router = APIRouter(prefix="/settings", tags=["settings"])

MODULE_VISIBILITY_KEY = "module_visibility"

DEFAULT_MODULES = {
    "student": {
        "dashboard": True, "subjects": True, "progress": True,
        "bookmarks": True, "assignments": True, "games": True,
        "downloads": True, "exams": True, "files": True,
        "payments": True, "notifications": True, "settings": True,
    },
    "teacher": {
        "overview": True, "students": True, "lessons": True,
        "assignments": True, "reports": True, "ai-assistant": True,
        "bookmarks": True, "files": True, "payments": True,
        "notifications": True, "settings": True,
    },
}


def _load_visibility(db: Session) -> dict:
    row = db.query(Setting).filter(Setting.key == MODULE_VISIBILITY_KEY).first()
    if not row:
        return DEFAULT_MODULES.copy()
    try:
        data = json.loads(row.value)
        # Merge with defaults so new modules appear as enabled
        for role, modules in DEFAULT_MODULES.items():
            if role not in data:
                data[role] = modules
            else:
                for mod, enabled in modules.items():
                    if mod not in data[role]:
                        data[role][mod] = enabled
        return data
    except (json.JSONDecodeError, TypeError):
        return DEFAULT_MODULES.copy()


def _save_visibility(db: Session, data: dict) -> None:
    row = db.query(Setting).filter(Setting.key == MODULE_VISIBILITY_KEY).first()
    value = json.dumps(data)
    if row:
        row.value = value
    else:
        db.add(Setting(key=MODULE_VISIBILITY_KEY, value=value))
    db.commit()


class ModuleVisibilityPayload(BaseModel):
    student: dict[str, bool] | None = None
    teacher: dict[str, bool] | None = None


@router.get("/modules")
def get_module_visibility(
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Return full module visibility for all roles (admin only)."""
    return _load_visibility(db)


@router.put("/modules")
def update_module_visibility(
    payload: ModuleVisibilityPayload,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update module visibility (admin only). Only provided roles are updated."""
    current = _load_visibility(db)
    if payload.student is not None:
        for mod, enabled in DEFAULT_MODULES.get("student", {}).items():
            current["student"][mod] = payload.student.get(mod, enabled)
    if payload.teacher is not None:
        for mod, enabled in DEFAULT_MODULES.get("teacher", {}).items():
            current["teacher"][mod] = payload.teacher.get(mod, enabled)
    _save_visibility(db, current)
    return current


@router.get("/modules/my")
def get_my_module_visibility(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return module visibility for the current user's role."""
    role = user.get("role", "")
    all_vis = _load_visibility(db)
    return all_vis.get(role, DEFAULT_MODULES.get(role, {}))


# --- Maintenance mode -------------------------------------------------------
#
# Lets an admin put the platform into a warm "under maintenance" state. Login,
# registration and account access still work normally, but students and
# teachers are shown a dignified maintenance screen (with the estimated return
# time) after they sign in. Admins are never blocked so they can turn it off.

MAINTENANCE_KEY = "maintenance"

DEFAULT_MAINTENANCE = {
    "enabled": False,
    "title": "We'll Be Back Soon",
    "message": (
        "We're making a few careful improvements to Casuya to serve you even "
        "better. Your learning progress is safe with us. Hang tight — we're "
        "almost ready to welcome you back."
    ),
    "until": None,  # ISO 8601 datetime string; when the platform returns
}


def _load_maintenance(db: Session) -> dict:
    row = db.query(Setting).filter(Setting.key == MAINTENANCE_KEY).first()
    if not row:
        return dict(DEFAULT_MAINTENANCE)
    try:
        data = json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return dict(DEFAULT_MAINTENANCE)
    merged = dict(DEFAULT_MAINTENANCE)
    if isinstance(data, dict):
        merged.update(data)
    return merged


def _save_maintenance(db: Session, data: dict) -> None:
    row = db.query(Setting).filter(Setting.key == MAINTENANCE_KEY).first()
    value = json.dumps(data)
    if row:
        row.value = value
    else:
        db.add(Setting(key=MAINTENANCE_KEY, value=value))
    db.commit()


class MaintenancePayload(BaseModel):
    enabled: bool | None = None
    title: str | None = None
    message: str | None = None
    until: str | None = None


@router.get("/maintenance")
def get_maintenance(db: Session = Depends(get_db)):
    """Public maintenance status. Unauthenticated so portal pages can gate on it
    before the app boots. Only `enabled` + messaging is exposed regardless of
    who asks; admins manage it through the admin settings screen."""
    data = _load_maintenance(db)
    return {
        "enabled": bool(data["enabled"]),
        "title": data["title"],
        "message": data["message"],
        "until": data["until"],
    }


@router.put("/maintenance")
def update_maintenance(
    payload: MaintenancePayload,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update maintenance mode (admin only)."""
    current = _load_maintenance(db)
    if payload.enabled is not None:
        current["enabled"] = bool(payload.enabled)
    if payload.title is not None:
        current["title"] = (payload.title or "").strip() or DEFAULT_MAINTENANCE["title"]
    if payload.message is not None:
        current["message"] = (payload.message or "").strip() or DEFAULT_MAINTENANCE["message"]
    if payload.until is not None:
        current["until"] = payload.until.strip() if payload.until.strip() else None
    _save_maintenance(db, current)
    return {
        "enabled": bool(current["enabled"]),
        "title": current["title"],
        "message": current["message"],
        "until": current["until"],
    }


# --- Platform Information / environment-variable health status --------------
#
# Reports the configured/healthy status of every backend setting (drawn from
# environment variables) plus live runtime checks (database, redis, SMTP).
# Secret values are never returned in full — only masked summaries.

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
