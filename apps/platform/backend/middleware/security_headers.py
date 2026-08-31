from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "/")
        method: str = scope.get("method", "GET")

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["X-XSS-Protection"] = "1; mode=block"
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
                headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com https://p.typekit.net; "
                    "font-src 'self' data: https://fonts.gstatic.com https://fonts.cdnfonts.com https://p.typekit.net https://use.typekit.net; "
                    "img-src 'self' data: blob:; "
                    "frame-src 'self'; "
                    "connect-src 'self'"
                )

                # ── Smart Cache-Control ───────────────────────────────────
                # Static assets (fonts, CSS, JS) → immutable long cache.
                # API data → private, revalidate so conditional requests work.
                # Health / auth / writes → never cache.
                status = message.get("status", 200)
                content_type = headers.get("content-type", "")

                if (
                    path.startswith("/static/")
                    or path.startswith("/assets/")
                    or path.startswith("/css/")
                    or path.startswith("/js/")
                    or path.startswith("/fonts/")
                    or path.startswith("/branding/")
                ):
                    headers["Cache-Control"] = "public, max-age=31536000, immutable"
                elif path in ("/health", "/readyz") or method in ("POST", "PUT", "DELETE", "PATCH"):
                    headers["Cache-Control"] = "no-store"
                elif (
                    "/api" in path
                    or path.startswith("/lessons")
                    or path.startswith("/subjects")
                    or path.startswith("/topics")
                ):
                    # API reads: allow stale-while-revalidate for fast repeat loads.
                    headers["Cache-Control"] = "private, max-age=5, stale-while-revalidate=30"
                else:
                    # HTML pages: short cache + revalidate.
                    headers["Cache-Control"] = "private, max-age=60, must-revalidate"

            await send(message)

        await self.app(scope, receive, send_wrapper)
