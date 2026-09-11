"""Maintenance mode — lets admins put the platform into a warm \"under
maintenance\" state. Login, registration and account access still work
normally, but students and teachers are shown a dignified maintenance screen
(with the estimated return time) after they sign in. Admins are never blocked
so they can turn it off."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.cache import cache_get, cache_invalidate, cache_set
from backend.middleware.permissions import require_role
from backend.models.setting import Setting

router = APIRouter(tags=["settings"])

MAINTENANCE_KEY = "maintenance"
MAINTENANCE_CACHE_KEY = "maintenance:state"

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
    cached = cache_get(MAINTENANCE_CACHE_KEY, ttl_seconds=60)
    if cached is not None:
        return cached
    data = _load_maintenance(db)
    payload = {
        "enabled": bool(data["enabled"]),
        "title": data["title"],
        "message": data["message"],
        "until": data["until"],
    }
    cache_set(MAINTENANCE_CACHE_KEY, payload, ttl=60)
    return payload


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
    cache_invalidate(MAINTENANCE_CACHE_KEY)
    return {
        "enabled": bool(current["enabled"]),
        "title": current["title"],
        "message": current["message"],
        "until": current["until"],
    }
