"""Casuya Platform — FastAPI entrypoint.

Run locally with:
    uvicorn backend.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI

from backend.app.health import add_health_routes
from backend.app.lifespan import lifespan
from backend.app.routers import include_routers
from backend.app.static import mount_frontend, mount_static
from backend.config.logging import configure_logging
from backend.config.settings import get_settings
from backend.middleware.compression import CompressionMiddleware
from backend.middleware.cors import add_cors
from backend.middleware.errors import register_error_handlers
from backend.middleware.rate_limit import RateLimitMiddleware
from backend.middleware.security_headers import SecurityHeadersMiddleware
from backend.middleware.sentry import init_sentry

settings = get_settings()
configure_logging()
init_sentry()

app = FastAPI(
    title=settings.app_name,
    description="Offline-first lesson delivery, quizzes, games, and progress tracking for Tanzanian secondary education.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    debug=settings.debug,
    lifespan=lifespan,
    redirect_slashes=False,
)

register_error_handlers(app)
app.add_middleware(CompressionMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
add_cors(app)

include_routers(app)

# Static asset mounts (lesson packages, shared lib, HLS, built JS packages).
mount_static(app, settings)

# Health/readiness are registered before the "/" frontend mount so they keep
# API priority over static file serving.
add_health_routes(app)

# Serve the static frontend LAST so API routes keep priority.
mount_frontend(app)