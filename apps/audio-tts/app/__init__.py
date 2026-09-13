"""Casuya Audio-TTS roots �?" service-internal router assembly.

Mirrors `apps/payments/app/__init__.py`: build the FastAPI app, wire the TTS +
misc routers, expose `/health`, `/readyz`. Every state-changing endpoint is
guarded by `require_api_key` (mirrors payments `require_api_key`).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routes_misc import router as misc_router
from app.routes_tts import router as tts_router
from app.services.synthesize import model_ready

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Piper loads lazily on first request; nothing to block startup on.
    yield


def include_routers(app: FastAPI) -> None:
    for router_module in (
        tts_router,
        # misc_router MUST be safe for a catch-all-free service; registering both
        # is fine because none of these declare a /{path:path} proxy.
        misc_router,
    ):
        app.include_router(router_module)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    include_routers(app)
    return app


app = create_app()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }


@app.get("/readyz")
def readyz():
    return {"status": "ok" if model_ready() else "degraded", "voice": model_ready()}
