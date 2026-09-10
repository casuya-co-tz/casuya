from __future__ import annotations

from backend.config.settings import get_settings


# Lock so that when multiple gunicorn workers start simultaneously, only one
# process runs the DDL reconciliation in init_db. Without this, concurrent
# create_all/ALTER could race. We use a Postgres advisory lock (PG-level,
# reliable across workers even when Redis is degraded); falls back to Redis
# SETNX only when Postgres is unavailable (local sqlite / dev).
_STARTUP_LOCK_KEY = "startup:init_db"
_STARTUP_ADVISORY_LOCK_ID = 73063015  # arbitrary constant for this lock
_startup_lock_conn = None  # holds the Postgres session that owns the advisory lock


def acquire_startup_lock(ttl: int = 300) -> bool:
    """Return True if this process owns the DB-init lock.

    Prefers a Postgres advisory lock (`pg_try_advisory_lock`), which is the
    only mechanism that safely serialises concurrent gunicorn workers when
    Redis is down or degraded. The advisory lock is session-scoped: it is
    held until unlocked or the connection closes.
    """
    from backend.config.database import get_engine, redis_client

    global _startup_lock_conn
    settings = get_settings()
    if settings.database_url.startswith("postgres"):
        try:
            engine = get_engine()
            conn = engine.connect()
            ok = False
            try:
                from sqlalchemy import text

                ok = conn.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": _STARTUP_ADVISORY_LOCK_ID}).scalar()
                if ok:
                    _startup_lock_conn = conn  # hold session so the lock persists
                    return True
            finally:
                if not ok:
                    conn.close()
            return False
        except Exception:
            return True  # DB unreachable: allow init (degraded / single-worker).
    try:
        result = redis_client.set(_STARTUP_LOCK_KEY, "1", nx=True, ex=ttl)
        if result is not None:
            return bool(result)
        if not redis_client.available:
            return True  # Redis unreachable: allow init (single-worker / degraded).
        return False
    except Exception:
        return True


def release_startup_lock() -> None:
    """Release the startup lock for this process if it holds one."""
    from backend.config.database import redis_client

    global _startup_lock_conn
    settings = get_settings()
    if settings.database_url.startswith("postgres"):
        try:
            if _startup_lock_conn is not None:
                from sqlalchemy import text

                _startup_lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _STARTUP_ADVISORY_LOCK_ID})
                _startup_lock_conn.commit()
                _startup_lock_conn.close()
                _startup_lock_conn = None
            return
        except Exception:
            pass
    try:
        redis_client.delete(_STARTUP_LOCK_KEY)
    except Exception:
        pass