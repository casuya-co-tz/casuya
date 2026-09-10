"""Lesson service — Redis-backed content cache helpers."""

from __future__ import annotations

from backend.middleware.cache import cache_get as redis_cache_get
from backend.middleware.cache import cache_invalidate
from backend.middleware.cache import cache_set as redis_cache_set

# ── Content cache (Redis-backed, survives restarts & shared across workers) ──
# Long TTL: the KaTeX-injected HTML is expensive to rebuild, but it only changes
# when the lesson is edited — and edit/publish/delete already invalidate this cache
# (see _cache_invalidate_content / cache_invalidate("lessons:")). So we cache for a
# day, which means the per-request injection runs at most once per content change.
CONTENT_CACHE_TTL = 86400  # 24 hours


def _cache_get(key: str) -> str | None:
    """Read from Redis cache. Returns str or None."""
    return redis_cache_get(f"lesson:content:{key}", ttl_seconds=CONTENT_CACHE_TTL)


def _cache_set(key: str, value: str):
    """Write to Redis cache with TTL."""
    redis_cache_set(f"lesson:content:{key}", value, ttl=CONTENT_CACHE_TTL)


def _cache_invalidate_content(slug: str):
    """Invalidate a specific lesson content cache entry."""
    try:
        from backend.config.database import redis_client

        redis_client.delete(f"cache:lesson:content:{slug}")
    except Exception:
        pass