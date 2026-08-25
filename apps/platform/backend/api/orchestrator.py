"""Casuya Orchestrator status endpoint.

The orchestrator is a standalone automation/maintenance tool (not an HTTP API
by default). When `casuya_orchestrator_health_url` is configured, this endpoint
reports its reachability. When unset, the endpoint simply reports that the
orchestrator is not deployed (so the rest of the platform is unaffected).
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter

from backend.config.settings import get_settings

router = APIRouter(prefix="/orchestrator", tags=["casuya-orchestrator"])


@router.get("/status")
def orchestrator_status():
    settings = get_settings()
    url = settings.casuya_orchestrator_health_url
    if not url:
        return {"deployed": False, "detail": "casuya_orchestrator_health_url not configured"}
    try:
        resp = httpx.get(url, timeout=2.0)
        return {"deployed": True, "status_code": resp.status_code, "healthy": resp.status_code < 400}
    except Exception as exc:  # noqa: BLE001
        return {"deployed": True, "reachable": False, "error": str(exc)}
