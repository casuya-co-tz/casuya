"""Static file serving tuned for the Casuya frontend.

Starlette's StaticFiles already serves a precompressed `<file>.gz` variant
(Content-Encoding: gzip) when the client sends `Accept-Encoding: gzip`. We
layer on correct, long-lived caching for built assets so repeated loads on
2G/3G are served from the browser/CDN cache and not re-fetched from Railway.
"""

from __future__ import annotations

from typing import Any

from starlette.staticfiles import StaticFiles

# Built assets (hashed/minified bundles) are immutable between deploys, so they
# can be cached aggressively by both the browser and any CDN in front.
_IMMUTABLE_EXTS = ("js", "css", "json", "svg", "woff2", "woff", "png", "jpg", "webp")

# Assets that change with a live edit (favicon, logos, config) — shorter TTL.
_DYNAMIC_PATHS = ("/assets/js/config.js", "/assets/js/env.js", "/branding/", "/favicon")


class PrecompressedStaticFiles(StaticFiles):
    """StaticFiles that serves `.gz` variants (built-in) and sets cache headers."""

    async def get_response(self, path: str, scope: dict):
        ext = (path.rsplit(".", 1)[-1].lower() if "." in path else "")
        resp = await super().get_response(path, scope)
        if resp.status_code != 200:
            return resp
        # Ensure Vary so CDN/browser keep separate encodings.
        resp.headers.setdefault("Vary", "Accept-Encoding")
        if ext in _IMMUTABLE_EXTS and not any(p in path for p in _DYNAMIC_PATHS):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            resp.headers.setdefault("Cache-Control", "public, max-age=300")
        return resp
