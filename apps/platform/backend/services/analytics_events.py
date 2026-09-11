"""Asynchronous event pipeline for the isolated analytics engine.

Decouples collection completely from the user runtime: beacons are normalized
and handed to a background draining thread, which writes to the analytics
cluster. Visitor identities are anonymized via a single-day cryptographic salt
mixed with ip + user-agent (Phase 2/3 privacy isolation).
"""

from __future__ import annotations

import hashlib
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from queue import Empty, Full, Queue

from backend.config.database_analytics import (
    analytics_available,
    insert_event,
    run_retention_compress,
)
from backend.config.settings import get_settings

logger = logging.getLogger(__name__)

_MAX_EVENT_ROUTE = 255
_MAX_EVENT_TYPE = 50
_MAX_QUEUE = 10_000  # hard cap so an un-routable flood cannot grow memory
_RETENTION_INTERVAL_HOURS = 24

_BOT_RE = re.compile(r"bot|crawl|spider|slurp|googlebot|bingpreview|facebookexternalhit|uptimerobot", re.I)
_MOBILE_RE = re.compile(r"Mobile|iPhone|Android|Windows Phone|BlackBerry|Opera Mini", re.I)
_TABLET_RE = re.compile(r"iPad|Tablet|Kindle|Silk", re.I)

_event_queue: Queue = Queue(maxsize=_MAX_QUEUE)
_worker: threading.Thread | None = None
_retention_thread: threading.Thread | None = None
_retention_stop = threading.Event()


# ─── Privacy isolation ──────────────────────────────────────────────────────

def _daily_salt() -> str:
    settings = get_settings()
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{day}{settings.analytics_salt_key or ''}"


def _visitor_hash(ip: str, user_agent: str) -> str:
    return hashlib.sha256(f"{ip}|{user_agent}|{_daily_salt()}".encode()).hexdigest()


def resolve_device_profile(user_agent: str) -> str:
    """Classify a UA string into the blueprint's device_profile grid."""
    if not user_agent:
        return "unknown"
    if _BOT_RE.search(user_agent):
        return "bot"
    if _TABLET_RE.search(user_agent):
        return "tablet"
    if _MOBILE_RE.search(user_agent):
        return "mobile"
    return "desktop"


def _clamp_int(value, lo: int, hi: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return lo
    return max(lo, min(hi, parsed))


def normalize_ingest(payload) -> dict | None:
    """Validate + truncate a raw beacon payload; None means 'drop'."""
    if not isinstance(payload, dict):
        return None
    interaction_type = str(payload.get("type") or "")[:_MAX_EVENT_TYPE].strip()
    if not interaction_type:
        return None
    return {
        "route_path": str(payload.get("path") or "/")[:_MAX_EVENT_ROUTE],
        "interaction_type": interaction_type,
        "scroll_depth": _clamp_int(payload.get("scroll"), 0, 100),
        "active_duration": _clamp_int(payload.get("duration"), 0, 4 * 3600),
        "device_profile": None,  # resolved at write time from real UA
    }


# ─── Background write path ──────────────────────────────────────────────────

def _drain_worker() -> None:
    while True:
        try:
            row = _event_queue.get(timeout=1.0)
        except Empty:
            if _retention_stop.is_set() and _event_queue.empty():
                return
            continue
        try:
            if analytics_available():
                insert_event(row)
        except Exception:  # noqa: BLE001
            logger.exception("analytics event insert failed; dropping row")
        finally:
            _event_queue.task_done()


def _start_drain_worker() -> None:
    global _worker
    if _worker is None:
        _worker = threading.Thread(target=_drain_worker, name="analytics-events", daemon=True)
        _worker.start()


def enqueue_event(
    *,
    route_path: str,
    interaction_type: str,
    scroll_depth: int = 0,
    active_duration: int = 0,
    ip: str = "",
    user_agent: str = "",
) -> bool:
    """Normalize, anonymize and enqueue a beacon for the write worker.

    Never raises and never blocks the caller beyond a put_nowait: analytics
    must be invisible to the user runtime.
    """
    if not analytics_available():
        return False
    _start_drain_worker()
    row = {
        "visitor_hash": _visitor_hash(ip, user_agent),
        "route_path": str(route_path)[:_MAX_EVENT_ROUTE],
        "interaction_type": str(interaction_type)[:_MAX_EVENT_TYPE],
        "scroll_depth": _clamp_int(scroll_depth, 0, 100),
        "active_duration": _clamp_int(active_duration, 0, 4 * 3600),
        "device_profile": resolve_device_profile(user_agent),
    }
    try:
        _event_queue.put_nowait(row)
        return True
    except Full:
        return False


# ─── Daily retention loop (Phase 6) ─────────────────────────────────────────

def run_retention_once() -> None:
    """Best-effort compression + purge; failures are logged, never fatal."""
    if not analytics_available():
        return
    try:
        result = run_retention_compress()
        logger.info("analytics retention: %s", result)
    except Exception:  # noqa: BLE001
        logger.exception("analytics retention job failed")


def _retention_loop() -> None:
    # Run once immediately (covers downtime since last compaction), then
    # every UTC midnight.
    run_retention_once()
    while not _retention_stop.wait(60):
        now = datetime.now(timezone.utc)
        next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        wait_seconds = max(0.0, (next_midnight - now).total_seconds())
        if _retention_stop.wait(wait_seconds):
            break
        run_retention_once()


def start_retention_loop() -> None:
    global _retention_thread
    _retention_stop.clear()
    if _retention_thread is None:
        _retention_thread = threading.Thread(target=_retention_loop, name="analytics-retention", daemon=True)
        _retention_thread.start()


def stop_retention_loop() -> None:
    _retention_stop.set()
