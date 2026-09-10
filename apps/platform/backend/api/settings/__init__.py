"""Platform settings API — module visibility, maintenance mode and status."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.settings import maintenance, modules, status
from backend.api.settings.maintenance import MaintenancePayload
from backend.api.settings.modules import ModuleVisibilityPayload

router = APIRouter(prefix="/settings", tags=["settings"])

router.include_router(modules.router)
router.include_router(maintenance.router)
router.include_router(status.router)

__all__ = ["router", "ModuleVisibilityPayload", "MaintenancePayload"]
