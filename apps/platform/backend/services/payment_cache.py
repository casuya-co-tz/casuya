"""In-memory payment cache — serves reads in <1ms.

Syncs from casuya-payments microservice in background.
Writes go to microservice, then invalidate + refresh cache.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

from backend.services.payments_client import get_payments_client

_lock = threading.Lock()

MAX_CACHE_SIZE = 1000
_sync_interval: float = 30.0

_payments: deque = deque(maxlen=MAX_CACHE_SIZE)
_subscriptions: deque = deque(maxlen=MAX_CACHE_SIZE)
_invoices: deque = deque(maxlen=MAX_CACHE_SIZE)
_refunds: deque = deque(maxlen=MAX_CACHE_SIZE)
_stats: dict = {}
_last_sync: float = 0
_running = False
_sync_count: int = 0
_error_count: int = 0


def _sync_from_microservice() -> None:
    """Pull all data from microservice into memory."""
    global _stats, _last_sync, _sync_count, _error_count
    try:
        client = get_payments_client()
        with _lock:
            payments = client.list_payments()
            _payments.clear()
            _payments.extend(payments[-MAX_CACHE_SIZE:])

            subscriptions = client.list_subscriptions()
            _subscriptions.clear()
            _subscriptions.extend(subscriptions[-MAX_CACHE_SIZE:])

            invoices = client.list_invoices()
            _invoices.clear()
            _invoices.extend(invoices[-MAX_CACHE_SIZE:])

            refunds = client.list_refunds()
            _refunds.clear()
            _refunds.extend(refunds[-MAX_CACHE_SIZE:])

            _stats = client.get_stats()
            _last_sync = time.monotonic()
            _sync_count += 1
    except ConnectionError:
        _error_count += 1


def _background_sync() -> None:
    """Background thread that syncs every _sync_interval seconds."""
    global _running
    while _running:
        _sync_from_microservice()
        time.sleep(_sync_interval)


def start_cache_sync() -> None:
    """Start background sync thread. Call once at app startup."""
    global _running
    if _running:
        return
    _running = True
    t = threading.Thread(target=_background_sync, daemon=True)
    t.start()


def stop_cache_sync() -> None:
    global _running
    _running = False


def invalidate() -> None:
    """Force immediate resync from microservice (call after writes)."""
    _sync_from_microservice()


# ── Read functions (served from memory) ────────────────────────────────────


def get_payments(user_id: str | None = None, status: str | None = None) -> list[dict]:
    with _lock:
        result = list(_payments)
        if user_id:
            result = [p for p in result if p.get("user_id") == user_id]
        if status:
            result = [p for p in result if p.get("status") == status]
        return result


def get_all_payments() -> list[dict]:
    with _lock:
        return list(_payments)


def get_subscriptions(user_id: str | None = None) -> list[dict]:
    with _lock:
        if user_id:
            return [s for s in _subscriptions if s.get("user_id") == user_id]
        return list(_subscriptions)


def get_invoices(user_id: str | None = None) -> list[dict]:
    with _lock:
        if user_id:
            return [i for i in _invoices if i.get("user_id") == user_id]
        return list(_invoices)


def get_refunds(user_id: str | None = None) -> list[dict]:
    with _lock:
        if user_id:
            return [r for r in _refunds if r.get("user_id") == user_id]
        return list(_refunds)


def get_stats(user_id: str | None = None) -> dict:
    if user_id:
        with _lock:
            user_payments = [p for p in _payments if p.get("user_id") == user_id]
            user_subs = [s for s in _subscriptions if s.get("user_id") == user_id]
            user_inv = [i for i in _invoices if i.get("user_id") == user_id]
            user_ref = [r for r in _refunds if r.get("user_id") == user_id]
            return {
                "total_payments": len(user_payments),
                "completed_payments": sum(1 for p in user_payments if p.get("status") == "success"),
                "total_revenue": sum(p.get("amount", 0) for p in user_payments if p.get("status") == "success"),
                "active_subscriptions": sum(1 for s in user_subs if s.get("status") == "active"),
                "pending_invoices": sum(1 for i in user_inv if i.get("status") == "pending"),
                "total_refunds": sum(r.get("amount", 0) for r in user_ref),
            }
    with _lock:
        return dict(_stats)


def get_last_sync() -> float:
    return _last_sync


def get_cache_stats() -> dict:
    return {
        "payments_count": len(_payments),
        "subscriptions_count": len(_subscriptions),
        "invoices_count": len(_invoices),
        "refunds_count": len(_refunds),
        "last_sync": _last_sync,
        "sync_count": _sync_count,
        "error_count": _error_count,
        "max_size": MAX_CACHE_SIZE,
    }
