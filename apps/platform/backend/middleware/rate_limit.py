import json
import logging
import time
from collections import defaultdict

from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

ENDPOINT_LIMITS = {
    "/auth/register": 5,
    "/auth/login": 10,
    "/auth/refresh": 10,
    "/payments/checkout": 10,
    "/payments/webhook": 30,
    "/v1/audio/tts": 60,
    "/v1/audio/stt": 15,
    "/v1/ocr/handwriting": 20,
}

EXEMPT_PATHS = {"/health", "/readyz"}

AUDIO_RATE_LIMIT_PATHS = {"/v1/audio/tts", "/v1/audio/stt"}

# In-memory fallback when Redis is unavailable (S-09)
_memory_store: dict[str, list[float]] = defaultdict(list)
_MEMORY_STORE_MAX = 10000  # prevent unbounded growth


def _prune_memory_store(now: float) -> None:
    """Drop expired entries/keys so rate limiting stays effective under churn."""
    window_start = now - 60
    stale_keys = []
    for key, entries in _memory_store.items():
        fresh = [t for t in entries if t > window_start]
        if fresh:
            _memory_store[key] = fresh
        else:
            stale_keys.append(key)
    for key in stale_keys:
        _memory_store.pop(key, None)
    if len(_memory_store) >= _MEMORY_STORE_MAX:
        # Still full: evict oldest buckets first to preserve rate-limit enforcement.
        oldest = sorted(_memory_store.items(), key=lambda kv: max(kv[1]) if kv[1] else 0)
        for key, _ in oldest[: max(1, len(_memory_store) // 10)]:
            _memory_store.pop(key, None)


def _header_from_scope(scope: Scope, name: str) -> str | None:
    want = name.lower().encode()
    for key, value in scope.get("headers", []):
        if key.lower() == want:
            return value.decode()
    return None


def rate_limit_key_for_request(scope: Scope, client_ip: str) -> str:
    """Build a rate-limit bucket key; audio routes prefer authenticated user id."""
    path = scope.get("path", "")
    if path in AUDIO_RATE_LIMIT_PATHS:
        auth = _header_from_scope(scope, "authorization")
        if auth and auth.startswith("Bearer "):
            try:
                from backend.config.security import decode_access_token

                payload = decode_access_token(auth.removeprefix("Bearer "))
                user_id = payload.get("sub")
                if user_id:
                    return f"rate_limit:user:{user_id}:{path}"
            except Exception:
                pass
    return f"rate_limit:{client_ip}:{path}"


def _rate_limited_429(limit: int, window_start: float, now: float):
    """Build + send a 429 response for the in-memory path."""
    ttl = int(window_start + 60 - now)
    body = json.dumps({"detail": f"Rate limit exceeded. Try again in {max(ttl, 1)} seconds."}).encode()
    return (
        {
            "type": "http.response.start",
            "status": 429,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body)).encode()],
            ],
        },
        {"type": "http.response.body", "body": body},
    )


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        path = scope.get("path", "")

        if method in {"OPTIONS", "HEAD"} or path in EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        from backend.config.settings import get_settings

        settings = get_settings()
        client = scope.get("client")
        client_ip = client[0] if client else "unknown"

        if client_ip == "testclient":
            await self.app(scope, receive, send)
            return
        limit = ENDPOINT_LIMITS.get(path, settings.rate_limit_per_minute)
        redis_key = rate_limit_key_for_request(scope, client_ip)
        now = time.time()
        window_start = now - 60

        # Routine endpoints (public reads, dashboards, data lists) use a cheap
        # in-memory bucket per worker instead of a Redis round-trip on every
        # request. A slow/distant Redis would otherwise dwarf the actual data
        # transfer and make every page load slower. Sensitive endpoints below
        # keep the strict shared Redis window. (S-12)
        if path not in ENDPOINT_LIMITS:
            if redis_key not in _memory_store and len(_memory_store) >= _MEMORY_STORE_MAX:
                _prune_memory_store(now)
            entries = _memory_store[redis_key]
            _memory_store[redis_key] = [t for t in entries if t > window_start]
            entries = _memory_store[redis_key]
            if len(entries) >= limit:
                start, body = _rate_limited_429(limit, window_start, now)
                await send(start)
                await send(body)
                return
            entries.append(now)
            await self.app(scope, receive, send)
            return

        try:
            from backend.config.database import redis_client

            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, 60)
            results = pipe.execute()

            hits = results[1]

            if hits >= limit:
                ttl = int(redis_client.ttl(redis_key))
                body = json.dumps({"detail": f"Rate limit exceeded. Try again in {ttl} seconds."}).encode()
                await send(
                    {
                        "type": "http.response.start",
                        "status": 429,
                        "headers": [
                            [b"content-type", b"application/json"],
                            [b"content-length", str(len(body)).encode()],
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": body})
                return
        except Exception as exc:
            # In-memory fallback when Redis is unavailable (S-09)
            logger.warning("Redis rate limit failed, using in-memory fallback: %s", exc)
            if redis_key not in _memory_store and len(_memory_store) >= _MEMORY_STORE_MAX:
                _prune_memory_store(now)
            entries = _memory_store[redis_key]
            _memory_store[redis_key] = [t for t in entries if t > window_start]
            entries = _memory_store[redis_key]
            if len(entries) >= limit:
                start, body = _rate_limited_429(limit, window_start, now)
                await send(start)
                await send(body)
                return
            entries.append(now)

        await self.app(scope, receive, send)
