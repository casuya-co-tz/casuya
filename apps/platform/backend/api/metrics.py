"""Real-User-Monitoring collector + dashboard (P3-3).

The frontend (assets/js/rum.js) sends paint/network timings from real devices.
We store them as a capped Redis list so a dashboard can drain and analyze them —
this lets us tune for *actual Tanzanian 3G*, not localhost. No auth: it is just
anonymous performance telemetry.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import Response

import json
import time

from backend.config.database import redis_client
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role

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


@router.get("/rum/summary")
@router.get("/rum/summary/")
async def rum_summary(current_user=Depends(require_role("admin"))):
    """Aggregate RUM data into a dashboard-friendly summary.

    Returns p50/p95/p99 for TTFB, FCP, DOM load, plus network breakdown
    by effectiveType (4g, 3g, 2g, slow-2g) and connection stats.
    """
    try:
        raw = redis_client.lrange("rum:events", 0, 1999)
    except Exception:
        return {"events": 0, "error": "redis unavailable"}

    if not raw:
        return {"events": 0}

    events = []
    for r in raw:
        try:
            ev = json.loads(r.decode("utf-8"))
            u = ev.get("u", {})
            if u:
                events.append(u)
        except Exception:
            continue

    if not events:
        return {"events": 0}

    def _percentile(values: list[float], p: float) -> float:
        if not values:
            return 0
        sorted_vals = sorted(values)
        idx = int(len(sorted_vals) * p / 100)
        return round(sorted_vals[min(idx, len(sorted_vals) - 1)], 1)

    def _avg(values: list[float]) -> float:
        return round(sum(values) / len(values), 1) if values else 0

    # Extract metrics
    ttfb = [e.get("ttfb", 0) for e in events if e.get("ttfb")]
    fcp = [e.get("fcp", 0) for e in events if e.get("fcp")]
    dom_load = [e.get("domLoad", 0) for e in events if e.get("domLoad")]
    load = [e.get("load", 0) for e in events if e.get("load")]
    rtt = [e.get("rtt", 0) for e in events if e.get("rtt")]
    downlink = [e.get("downlink", 0) for e in events if e.get("downlink")]

    # Network type breakdown
    network_counts = {}
    for e in events:
        et = e.get("effectiveType", "unknown")
        network_counts[et] = network_counts.get(et, 0) + 1

    # Page breakdown
    page_counts = {}
    for e in events:
        path = e.get("path", "/")
        page_counts[path] = page_counts.get(path, 0) + 1

    return {
        "events": len(events),
        "ttfb": {
            "p50": _percentile(ttfb, 50),
            "p95": _percentile(ttfb, 95),
            "p99": _percentile(ttfb, 99),
            "avg": _avg(ttfb),
        },
        "fcp": {
            "p50": _percentile(fcp, 50),
            "p95": _percentile(fcp, 95),
            "p99": _percentile(fcp, 99),
            "avg": _avg(fcp),
        },
        "dom_load": {
            "p50": _percentile(dom_load, 50),
            "p95": _percentile(dom_load, 95),
            "avg": _avg(dom_load),
        },
        "page_load": {
            "p50": _percentile(load, 50),
            "p95": _percentile(load, 95),
            "avg": _avg(load),
        },
        "network": {
            "rtt_avg": _avg(rtt),
            "downlink_avg": _avg(downlink),
            "by_type": network_counts,
        },
        "top_pages": sorted(page_counts.items(), key=lambda x: x[1], reverse=True)[:10],
    }
