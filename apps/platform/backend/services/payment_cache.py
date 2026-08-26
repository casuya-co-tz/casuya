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
    """Pull all data from microservice into memory.

    Raises ConnectionError when the microservice is unreachable so the caller
    can fall back to the local database.
    """
    global _stats, _last_sync, _sync_count, _error_count
    client = get_payments_client()
    with _lock:
        payments = client.list_payments()
        _payments.clear()
        _payments.extend(payments[-MAX_CACHE_SIZE:])

        subscriptions = client.list_subscriptions()
        _subscriptions.clear()
        _subscriptions_extend = subscriptions[-MAX_CACHE_SIZE:]
        _subscriptions.extend(_subscriptions_extend)

        invoices = client.list_invoices()
        _invoices.clear()
        _invoices.extend(invoices[-MAX_CACHE_SIZE:])

        refunds = client.list_refunds()
        _refunds.clear()
        _refunds.extend(refunds[-MAX_CACHE_SIZE:])

        _stats = client.get_stats()
        _last_sync = time.monotonic()
        _sync_count += 1


def _sync_from_db() -> None:
    """Populate the cache from the local database when the microservice is down.

    Only payments have a local table; subscriptions/invoices/refunds live in the
    microservice, so they stay empty here (the UI shows empty states for them).
    """
    global _stats, _last_sync, _sync_count, _error_count
    from backend.config.database import get_db
    from backend.models.payment import Payment

    _gen = get_db()
    db = next(_gen)
    try:
        rows = (
            db.query(Payment)
            .order_by(Payment.created_at.desc())
            .limit(MAX_CACHE_SIZE)
            .all()
        )
        payments = [
            {
                "id": p.id,
                "user_id": p.user_id,
                "amount_tzs": p.amount_tzs,
                "amount": p.amount_tzs,
                "provider": p.provider,
                "provider_reference": p.provider_reference,
                "plan_id": p.plan_id,
                "plan_name": p.plan_name,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "idempotency_key": p.idempotency_key,
            }
            for p in rows
        ]
        with _lock:
            _payments.clear()
            _payments.extend(payments)
            _stats = {}
            _last_sync = time.monotonic()
            _sync_count += 1
    except Exception:
        _error_count += 1
    finally:
        _gen.close()


def _sync() -> None:
    """Sync from microservice, falling back to the local DB if unreachable."""
    try:
        _sync_from_microservice()
    except ConnectionError:
        _sync_from_db()


def _background_sync() -> None:
    """Background thread that syncs every _sync_interval seconds."""
    global _running
    while _running:
        _sync()
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
    """Force immediate resync (microservice, or local DB if it's unreachable)."""
    _sync()


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
                "total_paid": sum(p.get("amount", 0) for p in user_payments if p.get("status") == "success"),
                "pending_amount": sum(p.get("amount", 0) for p in user_payments if p.get("status") == "pending"),
                "total_transactions": len(user_payments),
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
