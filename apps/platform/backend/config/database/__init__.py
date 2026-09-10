from __future__ import annotations

import logging
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ..redis import SafeRedis
from ..settings import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

connect_args = {"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {}

# Neon/Postgres connection budget. Neon enforces a hard per-instance
# connection allowance (often ~10-30) and aggressively recycles idle
# backends. A large fixed pool (e.g. 10+20 per process) can exceed that
# budget when several workers run, so we keep the pool small. When using
# Neon's *pooled* (PgBouncer-multiplexed) connection string this simply
# marks how many simultaneous DB calls each process may make and stays well
# inside Neon's allowance. pool_pre_ping validates stale pooled connections
# and a short pool_recycle matches Neon's idle-recycling of backends.
POOL_SIZE = 5
POOL_MAX_OVERFLOW = 10
POOL_RECYCLE = 300  # seconds (Neon recycles idle connections ~5 min)
POOL_TIMEOUT = 5  # seconds; fail fast rather than stacking stalled requests

# The engine is created lazily on first use so importing this module never
# fails when the database is unreachable. This lets the API start and serve
# health/static routes even with no database available.
_engine = None
SessionLocal: sessionmaker | None = None


def get_engine():
    """Return the SQLAlchemy engine, creating it on first use."""
    global _engine, SessionLocal
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            connect_args=connect_args,
            pool_size=POOL_SIZE,
            max_overflow=POOL_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=POOL_RECYCLE,
            pool_timeout=POOL_TIMEOUT,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


# SafeRedis degrades gracefully (no crash) when Redis is unavailable.
redis_client = SafeRedis(settings.redis_url)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Yield a DB session, raising a clear 503 if the database is unavailable."""
    if SessionLocal is None:
        get_engine()
    if SessionLocal is None:
        raise RuntimeError("Database engine is not available")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Read replica (P3-2). When DATABASE_REPLICA_URL is set, read-only endpoints use
# it to scale reads off the primary. Falls back to the primary when unset, so
# single-instance deployments need no config.
_replica_engine = None
ReplicaSessionLocal = None


def _connect_args_for(url: str) -> dict:
    return {"check_same_thread": False, "timeout": 30} if url.startswith("sqlite") else {}


def get_replica_engine():
    global _replica_engine, ReplicaSessionLocal
    if _replica_engine is None and settings.database_replica_url:
        _replica_engine = create_engine(
            settings.database_replica_url,
            connect_args=_connect_args_for(settings.database_replica_url),
            pool_size=POOL_SIZE,
            max_overflow=POOL_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=POOL_RECYCLE,
            pool_timeout=POOL_TIMEOUT,
        )
        ReplicaSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_replica_engine)
    return _replica_engine


def get_read_db() -> Generator[Session, None, None]:
    """Yield a read-replica session if configured, else the primary."""
    if ReplicaSessionLocal is None:
        get_replica_engine()
    if ReplicaSessionLocal is not None:
        db = ReplicaSessionLocal()
        try:
            yield db
        finally:
            db.close()
        return
    yield from get_db()


# Startup/DDL lock helpers and the init_db migration reconciliation live in
# submodules. They are imported last so the names above are fully defined
# before any cross-module reference resolves.
from .lock import acquire_startup_lock, release_startup_lock  # noqa: E402
from .migrations import init_db  # noqa: E402

__all__ = [
    "Base",
    "ReplicaSessionLocal",
    "SessionLocal",
    "acquire_startup_lock",
    "connect_args",
    "get_db",
    "get_engine",
    "get_read_db",
    "get_replica_engine",
    "init_db",
    "redis_client",
    "release_startup_lock",
]