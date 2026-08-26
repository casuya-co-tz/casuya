"""Real-User-Monitoring collector (P3-3).

The frontend (assets/js/rum.js) sends paint/network timings from real devices.
We store them as a capped Redis list so a dashboard can drain and analyze them —
this lets us tune for *actual Tanzanian 3G*, not localhost. No auth: it is just
anonymous performance telemetry.
"""

from fastapi import APIRouter
from fastapi.responses import Response

import json
import time

from backend.config.database import redis_client

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/rum")
@router.post("/rum/")
async def record_rum(payload: dict):
    try:
        event = {"ts": int(time.time()), "u": payload}
        redis_client.lpush("rum:events", json.dumps(event, default=str))
        redis_client.ltrim("rum:events", 0, 1999)
        redis_client.expire("rum:events", 60 * 60 * 24 * 30)
    except Exception:
        pass
    return Response(status_code=204)
