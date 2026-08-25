from __future__ import annotations

import functools
import json
from collections.abc import Sequence

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

ALL_METHODS = ("DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT")
SAFELISTED_HEADERS = {"Accept", "Accept-Language", "Content-Language", "Content-Type"}


class CORSMiddleware:
    """Drop-in replacement for Starlette's CORSMiddleware that also catches
    exceptions from the inner app and injects CORS headers before re-raising.
    Starlette's built-in CORSMiddleware only wraps ``send`` — if the inner app
    raises, the exception propagates *without* CORS headers, so the browser
    reports a CORS error instead of the real HTTP error."""

    def __init__(
        self,
        app: ASGIApp,
        allow_origins: Sequence[str] = (),
        allow_methods: Sequence[str] = ("GET",),
        allow_headers: Sequence[str] = (),
        allow_credentials: bool = False,
        allow_origin_regex: str | None = None,
        expose_headers: Sequence[str] = (),
        max_age: int = 600,
    ) -> None:
        import re

        if "*" in allow_methods:
            allow_methods = ALL_METHODS

        compiled_regex = re.compile(allow_origin_regex) if allow_origin_regex else None
        allow_all_origins = "*" in allow_origins
        allow_all_headers = "*" in allow_headers

        self.app = app
        self.allow_origins = allow_origins
        self.allow_methods = allow_methods
        self.allow_headers = sorted(SAFELISTED_HEADERS | set(allow_headers))
        self.allow_all_origins = allow_all_origins
        self.allow_all_headers = allow_all_headers
        self.allow_credentials = allow_credentials
        self.allow_origin_regex = compiled_regex
        self.max_age = max_age

        self._simple_headers: dict[str, str] = {}
        if allow_all_origins:
            self._simple_headers["Access-Control-Allow-Origin"] = "*"
        if allow_credentials:
            self._simple_headers["Access-Control-Allow-Credentials"] = "true"
        if expose_headers:
            self._simple_headers["Access-Control-Expose-Headers"] = ", ".join(expose_headers)

    def is_allowed_origin(self, origin: str) -> bool:
        if self.allow_all_origins:
            return True
        if self.allow_origin_regex is not None and self.allow_origin_regex.fullmatch(origin):
            return True
        return origin in self.allow_origins

    def _preflight_headers(self, origin: str) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.allow_all_origins and not self.allow_credentials:
            headers["Access-Control-Allow-Origin"] = "*"
        else:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Vary"] = "Origin"
        headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
        headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
        headers["Access-Control-Max-Age"] = str(self.max_age)
        if self.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"
        return headers

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope["method"]
        headers = Headers(scope=scope)
        origin = headers.get("origin")

        if origin is None:
            await self.app(scope, receive, send)
            return

        if not self.is_allowed_origin(origin):
            await self.app(scope, receive, send)
            return

        if method == "OPTIONS" and "access-control-request-method" in headers:
            preflight = self._preflight_headers(origin)
            body = b"OK"
            preflight["content-type"] = "text/plain"
            preflight["content-length"] = str(len(body))
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [[k.encode(), v.encode()] for k, v in preflight.items()],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return

        wrapped_send = functools.partial(self._send, send=send, origin=origin)
        try:
            await self.app(scope, receive, wrapped_send)
        except Exception:
            if not scope.get("_cors_response_sent"):
                error_body = json.dumps({"detail": "Internal Server Error"}).encode()
                cors_headers = self._preflight_headers(origin)
                cors_headers["content-type"] = "application/json"
                cors_headers["content-length"] = str(len(error_body))
                await send(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": [[k.encode(), v.encode()] for k, v in cors_headers.items()],
                    }
                )
                await send({"type": "http.response.body", "body": error_body})
                scope["_cors_response_sent"] = True
            raise

    async def _send(self, message: Message, *, send: Send, origin: str) -> None:
        if message["type"] != "http.response.start":
            await send(message)
            return

        scope = message.get("scope", {})
        if scope.get("_cors_response_sent"):
            await send(message)
            return

        message.setdefault("headers", [])
        hdrs = MutableHeaders(scope=message)

        for key, value in self._simple_headers.items():
            hdrs[key] = value

        if not self.allow_all_origins and self.is_allowed_origin(origin):
            hdrs["Access-Control-Allow-Origin"] = origin
            hdrs.add_vary_header("Origin")

        scope["_cors_response_sent"] = True
        await send(message)


def add_cors(app):
    from backend.config.settings import get_settings

    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "X-CSRF-Token",
        ],
        allow_origin_regex=settings.cors_origin_regex,
    )
