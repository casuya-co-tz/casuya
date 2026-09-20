"""In-process AI tutor telemetry for admin quality dashboard."""

from __future__ import annotations

import threading
import time
from collections import deque

_LOCK = threading.Lock()
_EVENTS: deque[dict] = deque(maxlen=500)
_COUNTERS = {
    "requests": 0,
    "stream": 0,
    "explain": 0,
    "offline": 0,
    "cached": 0,
    "format_complete": 0,
    "needs_review": 0,
    "deep_mode": 0,
}


def record_tutor_event(
    *,
    path: str,
    source: str = "casuya-ai",
    format_level: str = "none",
    latency_ms: int | None = None,
    needs_review: bool = False,
    provider_tier: str = "fast",
    offline: bool = False,
) -> None:
    now = time.time()
    with _LOCK:
        _COUNTERS["requests"] += 1
        if path.endswith("/stream"):
            _COUNTERS["stream"] += 1
        elif "/explain" in path:
            _COUNTERS["explain"] += 1
        if source in ("offline", "local-cache"):
            _COUNTERS["offline"] += 1
        if source == "cached":
            _COUNTERS["cached"] += 1
        if format_level == "complete":
            _COUNTERS["format_complete"] += 1
        if needs_review:
            _COUNTERS["needs_review"] += 1
        if provider_tier == "quality":
            _COUNTERS["deep_mode"] += 1
        _EVENTS.appendleft(
            {
                "at": now,
                "path": path,
                "source": source,
                "format_level": format_level,
                "latency_ms": latency_ms,
                "needs_review": needs_review,
                "provider_tier": provider_tier,
                "offline": offline,
            }
        )


def tutor_telemetry_snapshot() -> dict:
    with _LOCK:
        total = max(_COUNTERS["requests"], 1)
        samples = list(_EVENTS)[:20]
        counters = dict(_COUNTERS)
    return {
        "counters": counters,
        "rates": {
            "format_complete_pct": round(100 * counters["format_complete"] / total, 1),
            "offline_pct": round(100 * counters["offline"] / total, 1),
            "needs_review_pct": round(100 * counters["needs_review"] / total, 1),
        },
        "samples": samples,
    }
