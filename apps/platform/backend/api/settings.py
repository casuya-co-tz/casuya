"""Module visibility settings — lets admins toggle which sidebar modules
are shown to students and teachers."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.setting import Setting

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
