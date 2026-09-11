import hashlib
import json
import threading
import time

from fastapi import Request, Response

from backend.config.database import redis_client

# Namespace prefix so casuya keys don't collide with rate-limit / job keys.
_KEY_PREFIX = "cache:"

# ── In-process fallback store ──────────────────────────────────────────────
# Used when Redis is unavailable so application-level caching still works on
# small deployments (no extra infrastructure). A plain dict + lock is enough:
# FastAPI async workers keep this cheap, and the TTL keeps memory bounded.
_MEM_LOCK = threading.Lock()
_MEMORY_CACHE: dict[str, tuple[float, object]] = {}
_MEM_TTL_MAX = 3600  # never hold fallback entries longer than this


def _memory_get(key: str):
    with _MEM_LOCK:
        entry = _MEMORY_CACHE.get(key)
        if entry is None:
            return None
        stored_at, value = entry
        if time.time() - stored_at > _MEM_TTL_MAX:
            _MEMORY_CACHE.pop(key, None)
            return None
        return value


def _memory_set(key: str, value: object, ttl: int) -> None:
    with _MEM_LOCK:
        if len(_MEMORY_CACHE) > 5000:
            _MEMORY_CACHE.clear()
        _MEMORY_CACHE[key] = (time.time(), value)


def _memory_invalidate(pattern: str) -> None:
    with _MEM_LOCK:
        prefix = f"{_KEY_PREFIX}{pattern}"
        for k in [k for k in _MEMORY_CACHE if k.startswith(prefix)]:
            _MEMORY_CACHE.pop(k, None)


def cache_get(key: str, ttl_seconds: int = 60):
    """Return cached value or None if missing / expired.

    Uses Redis TTL for primary expiry. The embedded timestamp is a secondary
    guard: if a caller requests a shorter TTL than the Redis TTL, stale
    entries are still rejected at the app level.

    When Redis is unavailable this degrades to the in-process store, so
    cached endpoints keep working (and stay fast) without extra infra.
    """
    try:
        value = redis_client.get(_KEY_PREFIX + key)
        if value is None:
            return _memory_get(_KEY_PREFIX + key)
        data = json.loads(value.decode("utf-8"))
        # Backward-compatible: old format stores [timestamp, value],
        # new format stores value directly.
        if isinstance(data, list) and len(data) == 2 and isinstance(data[0], int | float):
            timestamp, actual_value = data
            if time.time() - timestamp > ttl_seconds:
                return None
            return actual_value
        return data
    except Exception:
        return _memory_get(_KEY_PREFIX + key)


def cache_set(key: str, value: object, ttl: int = 300):
    """Write a value to the cache with a TTL (default 5 min).

    Stores value directly (no embedded timestamp) — Redis TTL handles expiry.
    Falls back to the in-process store when Redis is unavailable (SafeRedis
    returns a falsy value instead of raising on connection failures).
    """
    try:
        result = redis_client.setex(_KEY_PREFIX + key, ttl, json.dumps(value, default=str).encode("utf-8"))
    except Exception:
        result = None
    if not result:
        _memory_set(_KEY_PREFIX + key, value, ttl)


def cache_invalidate(pattern: str | None = None):
    """Delete keys matching a pattern using SCAN (non-blocking)."""
    try:
        if pattern is None:
            return 0
        cursor = 0
        match_pattern = f"{_KEY_PREFIX}{pattern}*"
        deleted = 0
        while True:
            cursor, keys = redis_client.scan(cursor, match=match_pattern, count=100)
            if keys:
                redis_client.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        _memory_invalidate(pattern)
        return deleted
    except Exception:
        _memory_invalidate(pattern)
        return 0


def etag_for(data: object) -> str:
    """Compute a stable ETag from a JSON-serialisable object."""
    raw = json.dumps(data, sort_keys=True, default=str).encode()
    return '"' + hashlib.sha256(raw).hexdigest()[:16] + '"'


def apply_public_cache(response: Response, request: Request, data: object, max_age: int = 600):
    """Attach browser/edge-cacheable headers to public read-only responses.

    Sets an ETag + ``Cache-Control: public`` and returns a ``304 Not
    Modified`` response when the client's ``If-None-Match`` matches, letting
    repeat loads on 2G/3G skip re-downloading static reference data
    (subjects, syllabus trees, exam presets…).

    Call it as::

        not_modified = apply_public_cache(response, request, result, max_age=600)
        if not_modified is not None:
            return not_modified
        return result
    """
    etag = etag_for(data)
    cache_control = f"public, max-age={max_age}"
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = cache_control
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": cache_control})
    return None
