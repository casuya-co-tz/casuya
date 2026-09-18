"""Lesson service — Redis-backed content cache helpers."""

from __future__ import annotations

from backend.middleware.cache import cache_get as redis_cache_get
from backend.middleware.cache import cache_invalidate
from backend.middleware.cache import cache_set as redis_cache_set

from .paths import get_gzip_path

CONTENT_CACHE_TTL = 86400  # 24 hours


def _cache_get(key: str) -> str | None:
    """Read from Redis cache. Returns str or None."""
    return redis_cache_get(f"lesson:content:{key}", ttl_seconds=CONTENT_CACHE_TTL)


def _cache_set(key: str, value: str):
    """Write to Redis cache with TTL."""
    redis_cache_set(f"lesson:content:{key}", value, ttl=CONTENT_CACHE_TTL)


def _cache_invalidate_content(slug: str):
    """Invalidate a specific lesson content cache entry and gzip sidecar."""
    try:
        from backend.config.database import redis_client

        redis_client.delete(f"cache:lesson:content:{slug}")
    except Exception:
        pass
    try:
        gz = get_gzip_path(slug)
        if gz.exists():
            gz.unlink()
    except Exception:
        pass