"""Brotli / GZip response compression middleware.

Compresses responses whose Content-Type is compressible and whose body
exceeds a minimum threshold.  Brotli is preferred when the client supports
it; otherwise GZip is used.

The middleware is zero-config — just add it to the ASGI stack in main.py.
"""

from __future__ import annotations

import gzip
import re
from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

# Compressible MIME types (anything text-ish, JSON, SVG, wasm …)
_COMPRESSIBLE_RE = re.compile(
    r"(text/|application/(json|javascript|xml|wasm|svg|ld\+json|x-yaml|yaml))",
    re.IGNORECASE,
)

# Minimum body size (bytes) before we bother compressing.
_MIN_SIZE = 500

# gzip compress level (1 = fastest, 9 = smallest; 6 is the default)
_GZIP_LEVEL = 6


class CompressionMiddleware:
    """ASGI middleware that compresses eligible responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Determine what the client accepts *before* the response is built.
        accept = scope.get("headers", [])
        accept_encoding = ""
        for name, value in accept:
            if name == b"accept-encoding":
                accept_encoding = value.decode("latin-1").lower()
                break

        use_brotli = "br" in accept_encoding
        use_gzip = "gzip" in accept_encoding

        if not use_brotli and not use_gzip:
            await self.app(scope, receive, send)
            return

        body_chunks: list[bytes] = []
        initial_headers: dict[str, str] = {}
        status_code = 200
        passthrough = False
        start_message: dict[str, Any] | None = None

        async def send_wrapper(message: dict[str, Any]) -> None:
            nonlocal status_code, initial_headers, passthrough, start_message

            if passthrough:
                await send(message)
                return

            if message["type"] == "http.response.start":
                status_code = message["status"]
                initial_headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in message.get("headers", [])}
                content_type = initial_headers.get("content-type", "")
                already_compressed = initial_headers.get("content-encoding", "")
                if already_compressed or not _COMPRESSIBLE_RE.search(content_type):
                    passthrough = True
                    await send(message)
                    return
                start_message = message
                return

            if message["type"] == "http.response.body":
                body = message.get("body", b"")
                if body:
                    body_chunks.append(body)
                if message.get("more_body", False):
                    return
                full_body = b"".join(body_chunks)
                content_type = initial_headers.get("content-type", "")
                already_compressed = initial_headers.get("content-encoding", "")
                can_compress = (
                    not already_compressed and len(full_body) >= _MIN_SIZE and _COMPRESSIBLE_RE.search(content_type)
                )

                if can_compress:
                    if use_brotli:
                        try:
                            import brotli

                            full_body = brotli.compress(full_body, quality=4)
                            initial_headers["content-encoding"] = "br"
                        except ImportError:
                            full_body = gzip.compress(full_body, compresslevel=_GZIP_LEVEL)
                            initial_headers["content-encoding"] = "gzip"
                    else:
                        full_body = gzip.compress(full_body, compresslevel=_GZIP_LEVEL)
                        initial_headers["content-encoding"] = "gzip"
                    initial_headers.pop("content-length", None)
                    if "vary" not in {k.lower() for k in initial_headers}:
                        initial_headers["vary"] = "Accept-Encoding"

                headers_list = [
                    (k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in initial_headers.items()
                ]
                await send(
                    {
                        "type": "http.response.start",
                        "status": status_code,
                        "headers": headers_list,
                    }
                )
                await send({"type": "http.response.body", "body": full_body, "more_body": False})

        await self.app(scope, receive, send_wrapper)
