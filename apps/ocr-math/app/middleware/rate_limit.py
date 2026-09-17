"""In-memory rate limits for the Math OCR microservice (mirrors audio-stt)."""

from __future__ import annotations

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

ENDPOINT_LIMITS: dict[str, int] = {
    "/v1/ocr/recognize": 30,
}

DEFAULT_LIMIT = 120
_WINDOW_SECONDS = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.method in {"OPTIONS", "HEAD"}:
            return await call_next(request)

        path = request.url.path.rstrip("/") or "/"
        limit = ENDPOINT_LIMITS.get(path, DEFAULT_LIMIT)
        client = request.client.host if request.client else "unknown"
        key = f"{client}:{path}"
        now = time.time()
        window_start = now - _WINDOW_SECONDS

        entries = [t for t in self._hits[key] if t > window_start]
        if len(entries) >= limit:
            ttl = max(1, int(entries[0] + _WINDOW_SECONDS - now))
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Try again in {ttl} seconds."},
            )

        entries.append(now)
        self._hits[key] = entries
        return await call_next(request)
