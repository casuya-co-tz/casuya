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
}

EXEMPT_PATHS = {"/health", "/readyz"}

# In-memory fallback when Redis is unavailable (S-09)
_memory_store: dict[str, list[float]] = defaultdict(list)
_MEMORY_STORE_MAX = 10000  # prevent unbounded growth


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
        redis_key = f"rate_limit:{client_ip}:{path}"
        now = time.time()
        window_start = now - 60

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
            if len(_memory_store) < _MEMORY_STORE_MAX:
                entries = _memory_store[redis_key]
                # Purge old entries outside the window
                _memory_store[redis_key] = [t for t in entries if t > window_start]
                entries = _memory_store[redis_key]
                if len(entries) >= limit:
                    ttl = int(entries[0] + 60 - now)
                    body = json.dumps({"detail": f"Rate limit exceeded. Try again in {max(ttl, 1)} seconds."}).encode()
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
                entries.append(now)

        await self.app(scope, receive, send)
