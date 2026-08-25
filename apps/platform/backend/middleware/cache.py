import hashlib
import json
import time

from backend.config.database import redis_client

# Namespace prefix so casuya keys don't collide with rate-limit / job keys.
_KEY_PREFIX = "cache:"


def cache_get(key: str, ttl_seconds: int = 60):
    """Return cached value or None if missing / expired."""
    try:
        value = redis_client.get(_KEY_PREFIX + key)
        if value is None:
            return None
        data = json.loads(value.decode("utf-8"))
        timestamp, actual_value = data[0], data[1]
        if time.time() - timestamp > ttl_seconds:
            redis_client.delete(_KEY_PREFIX + key)
            return None
        return actual_value
    except Exception:
        return None


def cache_set(key: str, value: object, ttl: int = 300):
    """Write a value to the cache with a TTL (default 5 min)."""
    try:
        data = [time.time(), value]
        redis_client.setex(_KEY_PREFIX + key, ttl, json.dumps(data).encode("utf-8"))
    except Exception:
        pass


def cache_invalidate(pattern: str | None = None):
    """Delete keys matching a pattern using SCAN (non-blocking)."""
    try:
        if pattern is None:
            return
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
        return deleted
    except Exception:
        pass


def etag_for(data: object) -> str:
    """Compute a stable ETag from a JSON-serialisable object."""
    raw = json.dumps(data, sort_keys=True, default=str).encode()
    return '"' + hashlib.sha256(raw).hexdigest()[:16] + '"'
