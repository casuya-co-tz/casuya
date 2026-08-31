"""Casuya Platform — FastAPI entrypoint.

Run locally with:
    uvicorn backend.main:app --reload
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.middleware.static_precompressed import PrecompressedStaticFiles

from backend.api import (
    ai,
    analytics,
    assignments,
    auth,
    bookmarks,
    branding,
    casuya_api_proxy,
    core,
    games,
    lessons,
    math,
    note,
    metrics,
    notifications,
    oauth,
    orchestrator,
    payments,
    progress,
    quizzes,
    search,
    services_bridge,
    settings as settings_api,
    students,
    subjects,
    subtopics,
    syllabus,
    teachers,
    topics,
    transcode,
    uploads,
    users,
)
from backend.config.database import init_db
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.services.email_service import smtp_configured

    print(f"SMTP {'configured' if smtp_configured() else 'NOT configured (email resets disabled)'}")
    from backend.config.database import acquire_startup_lock, release_startup_lock

    # Only one worker runs the DDL/migration/rehydrate sequence; the others
    # skip it once the lock is held by the leader (enables multi-worker boots).
    acquired = await asyncio.to_thread(acquire_startup_lock)
    try:
        if acquired:
            await asyncio.to_thread(init_db)

            # Auto-provision admin if env vars are present (useful for Render Free tier w/o shell)
            import os

            admin_email = os.environ.get("CASUYA_ADMIN_EMAIL", "").strip()
            admin_password = os.environ.get("CASUYA_ADMIN_PASSWORD", "").strip()
            if admin_email and admin_password:
                from database.seeds.create_admin import create_admin

                admin_name = os.environ.get("CASUYA_ADMIN_NAME", "Platform Admin")
                await asyncio.to_thread(create_admin, admin_email, admin_password, admin_name)

            # Restore generated HTML/uploads from the database so content survived
            # any ephemeral filesystem wipe (Render Free, etc.).
            from backend.services.storage_rehydrate import rehydrate_storage

            await asyncio.to_thread(rehydrate_storage)

            # Deploy Cloudflare cache rules on startup (P3-1)
            # Safe no-op when Cloudflare credentials are not configured.
            try:
                from integrations.cloudflare import deploy_cache_rules

                rules_result = await asyncio.to_thread(deploy_cache_rules)
                if rules_result.get("status") == "success":
                    print(f"Cloudflare cache rules {rules_result.get('action')}: {rules_result.get('rules_count')} rules")
            except Exception as cf_exc:
                print(f"Cloudflare rules deployment skipped: {cf_exc}")

    except Exception as exc:  # noqa: BLE001
        # Tolerate an unreachable/unconfigured database in local dev so the
        # API still serves health/readiness and static routes.
        print(f"WARNING: init_db failed, continuing without DB: {exc}")
    finally:
        if acquired:
            await asyncio.to_thread(release_startup_lock)

    from backend.services.payment_cache import start_cache_sync, stop_cache_sync

    start_cache_sync()
    yield
    stop_cache_sync()


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

for router_module in (
    auth,
    branding,
    users,
    students,
    teachers,
    lessons,
    subjects,
    topics,
    subtopics,
    syllabus,
    quizzes,
    games,
    progress,
    analytics,
    core,
    payments,
    notifications,
    orchestrator,
    search,
    services_bridge,
    uploads,
    transcode,
    bookmarks,
    note,
    metrics,
    ai,
    math,
    assignments,
    settings_api,
    # casuya_api_proxy MUST be last — catch-all /{path:path}
    casuya_api_proxy,
):
    app.include_router(router_module.router)

# Merge oauth routes into the auth router so they share prefix="/auth"
# without declaring it twice.
app.include_router(oauth.router, prefix="/auth")

# Mount lesson packages as static files for direct CDN/reverse-proxy serving
pkg_dir = Path(settings.storage_root) / "lesson-packages"
pkg_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/lessons", StaticFiles(directory=str(pkg_dir)), name="lesson-packages")

# Mount shared library files (KaTeX, etc.) for offline-first lesson rendering
lib_dir = Path(settings.storage_root) / "lib"
lib_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/lib", StaticFiles(directory=str(lib_dir)), name="shared-lib")

# Mount HLS transcoded videos for adaptive streaming (360p/480p/720p renditions)
hls_dir = Path(settings.storage_root) / "hls"
hls_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/hls", StaticFiles(directory=str(hls_dir)), name="hls-videos")

# Mount built client-side Casuya packages so the web app can load them directly.
# These point at the monorepo package dist folders; when absent they are skipped.
import os as _os

_repo_root = Path(__file__).resolve().parents[2]  # casuya-platform/backend -> repo root

# Single-package dist folders.
_pkg_mounts = [
    ("casuya-runtime", "dist", "/static/pkg/runtime"),
    ("casuya-blackboard", "dist", "/static/pkg/blackboard"),
    ("casuya-editor", "dist", "/static/pkg/editor"),
    ("casuya-math", "dist", "/static/pkg/math"),
]
for _pkg, _sub, _route in _pkg_mounts:
    _d = _repo_root / _pkg / _sub
    if _d.is_dir():
        app.mount(_route, StaticFiles(directory=str(_d)), name=f"pkg-{_pkg}")

# casuya-design-system is a pnpm sub-workspace; mount each built sub-package.
_ds_root = _repo_root / "casuya-design-system" / "packages"
if _ds_root.is_dir():
    for _ds_pkg in _ds_root.iterdir():
        if _ds_pkg.is_dir():
            _dd = _ds_pkg / "dist"
            if _dd.is_dir():
                _route = f"/static/pkg/design-system/{_ds_pkg.name}"
                app.mount(_route, StaticFiles(directory=str(_dd)), name=f"pkg-design-system-{_ds_pkg.name}")


@app.get("/health")
def health_check():
    from backend.services.email_service import smtp_configured

    return {
        "status": "ok",
        "environment": settings.environment,
        "smtp_configured": smtp_configured(),
    }


@app.get("/readyz")
def readiness_check():
    from sqlalchemy import text

    from backend.config.database import get_engine, redis_client

    db_ok = False
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    redis_ok = False
    try:
        redis_ok = redis_client.ping()
    except Exception:
        pass

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "database": db_ok,
        "redis": redis_ok,
    }


# Serve the static frontend (HTML/JS/CSS) from the repo's frontend/ directory.
# Mounted LAST so API routes keep priority; html=True lets "/" return index.html.
# This makes the API and the web app share one origin (no CORS, works on Koyeb).
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if _FRONTEND_DIR.is_dir():
    # PrecompressedStaticFiles serves existing `.gz` assets with
    # Content-Encoding: gzip when the client supports it, plus sane cache
    # headers, so large bundles transfer 60-80% smaller on 2G/3G.
    app.mount("/", PrecompressedStaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
