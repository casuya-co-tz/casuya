"""Brotli / GZip response compression middleware.

Compresses responses whose Content-Type is compressible and whose body
exceeds a minimum threshold.  Brotli is preferred when the client supports
it; otherwise GZip is used.  Both encodings are streamed so large responses
are never fully buffered in memory.
"""
from __future__ import annotations

import brotli
import gzip
import re
import zlib
from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

# Compressible MIME types (anything text-ish, JSON, SVG, wasm …)
_COMPRESSIBLE_RE = re.compile(
    r"(text/|application/(json|javascript|xml|wasm|svg|ld\+json|x-yaml|yaml))",
    re.IGNORECASE,
)

# Streaming content types must not be buffered; compressing them would delay
# first-byte delivery (SSE streaming) or buffer large file streams in memory.
_SKIP_CONTENT_TYPES = ("text/event-stream", "application/x-ndjson")

# Minimum body size (bytes) before we bother compressing.
_MIN_SIZE = 500

# Maximum buffered body size before we give up on compression and stream through.
# Prevents large responses from being fully buffered in memory.
_MAX_BUFFER_SIZE = 1_000_000

# gzip compress level (1 = fastest, 9 = smallest; 6 is the default)
_GZIP_LEVEL = 6

# Brotli quality (0-11; 4 is a good speed/size tradeoff for dynamic content)
_BROTLI_QUALITY = 4


class CompressionMiddleware:
    """ASGI middleware that compresses eligible responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

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

        preferred = "br" if use_brotli else "gzip"

        body_chunks: list[bytes] = []
        initial_headers: dict[str, str] = {}
        status_code = 200
        passthrough = False
        start_message: dict[str, Any] | None = None
        compressor: Any = None
        encoding: str | None = None
        streaming = False
        decided = False

        async def _send_start(headers: dict[str, str], status: int) -> None:
            headers_list = [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers.items()]
            await send({"type": "http.response.start", "status": status, "headers": headers_list})

        async def send_wrapper(message: dict[str, Any]) -> None:
            nonlocal status_code, initial_headers, passthrough, start_message
            nonlocal compressor, encoding, streaming, decided

            if passthrough:
                await send(message)
                return

            if message["type"] == "http.response.start":
                status_code = message["status"]
                initial_headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in message.get("headers", [])}
                content_type = initial_headers.get("content-type", "")
                already_compressed = initial_headers.get("content-encoding", "")
                if (
                    already_compressed
                    or status_code < 200
                    or status_code in (204, 304)
                    or not _COMPRESSIBLE_RE.search(content_type)
                    or any(ct in content_type for ct in _SKIP_CONTENT_TYPES)
                ):
                    passthrough = True
                    await send(message)
                    return
                start_message = message
                return

            if message["type"] != "http.response.body":
                await send(message)
                return

            body = message.get("body", b"")
            more_body = bool(message.get("more_body", False))

            if not body and more_body:
                if passthrough:
                    await send(message)
                    return
                if streaming:
                    await send({"type": "http.response.body", "body": b"", "more_body": True})
                    return
                return

            if body:
                body_chunks.append(body)

            total_size = sum(len(c) for c in body_chunks)

            # Decide once we have enough data or the response is complete.
            if not decided and more_body and total_size < _MIN_SIZE and total_size < _MAX_BUFFER_SIZE:
                return

            decided = True

            # Passthrough cases: too small, too large, or no compressor available.
            # Only passthrough before headers have been sent (buffering phase);
            # once streaming has started we must keep compressing.
            if (not streaming) and (total_size < _MIN_SIZE or total_size > _MAX_BUFFER_SIZE):
                passthrough = True
                if start_message is not None:
                    await send(start_message)
                    start_message = None
                if not body_chunks:
                    await send(message)
                    return
                for idx, chunk in enumerate(body_chunks):
                    last = idx == len(body_chunks) - 1
                    await send(
                        {
                            "type": "http.response.body",
                            "body": chunk,
                            "more_body": True if more_body else (not last),
                        }
                    )
                body_chunks.clear()
                return

            # Commit to compression.
            if compressor is None:
                encoding = preferred
                initial_headers.pop("content-length", None)
                initial_headers["content-encoding"] = encoding
                vary_values = [v.strip() for v in initial_headers.get("vary", "").split(",") if v.strip()]
                if not any(v.lower() == "accept-encoding" for v in vary_values):
                    vary_values.append("Accept-Encoding")
                    initial_headers["vary"] = ", ".join(vary_values)
                if encoding == "br":
                    compressor = brotli.Compressor(quality=_BROTLI_QUALITY)
                else:
                    compressor = zlib.compressobj(_GZIP_LEVEL, zlib.DEFLATED, 16 + zlib.MAX_WBITS)
                streaming = True
                await _send_start(initial_headers, status_code)
                start_message = None

            # Compress buffered + current body in one shot for better ratio.
            payload = b"".join(body_chunks)
            body_chunks.clear()
            if encoding == "br":
                compressed = compressor.process(payload) if payload else b""
            else:
                compressed = compressor.compress(payload) if payload else b""
            if not more_body:
                if encoding == "br":
                    compressed += compressor.finish()
                else:
                    compressed += compressor.flush()
            await send({"type": "http.response.body", "body": compressed, "more_body": more_body})

        await self.app(scope, receive, send_wrapper)
