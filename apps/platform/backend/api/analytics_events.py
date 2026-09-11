"""Isolated web-analytics beacons + admin extraction (Neon analytics cluster).

Public endpoints on this router take unauthenticated browser beacons and hand
them to the anonymizing write pipeline; read-back endpoints stay admin-only.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from backend.config.database_analytics import get_summary
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.services.analytics_events import enqueue_event, normalize_ingest

router = APIRouter(prefix="/api/analytics", tags=["analytics-events"])

_admin = [Depends(require_role("admin"))]


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else ""


@router.post("/ingest")
@router.post("/ingest/")
async def ingest_event(request: Request):
    """Accept a fire-and-forget browser beacon and return 202.

    Payload (content-type agnostic; sendBeacon sends text/plain):
      {"path": "/login", "type": "page_exit_metric", "scroll": 45, "duration": 120}
    Malformed payloads are dropped with 400 exactly like the blueprint.
    """
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        payload = None

    row = normalize_ingest(payload)
    if row is None:
        return JSONResponse({"status": "drop"}, status_code=400)

    enqueue_event(
        route_path=row["route_path"],
        interaction_type=row["interaction_type"],
        scroll_depth=row["scroll_depth"],
        active_duration=row["active_duration"],
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    return JSONResponse({"status": "queued"}, status_code=202)


@router.get("/summary", response_model=dict, dependencies=_admin)
@router.get("/summary/", response_model=dict, dependencies=_admin)
def analytics_summary(current_user=Depends(get_current_user)):
    """Phase-5 warehouse extraction: top routes + 24h successful logins."""
    return get_summary()
