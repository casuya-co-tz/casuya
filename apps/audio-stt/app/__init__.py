"""Casuya Audio-STT routing assembly (mirrors apps/audio-tts/app/__init__.py)."""

from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes_stt import router as stt_router
from app.services.transcribe import model_ready

settings = get_settings()


def include_routers(app: FastAPI) -> None:
    app.include_router(stt_router)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0")
    app.add_middleware(RateLimitMiddleware)
    include_routers(app)
    return app


app = create_app()


@app.get("/readyz")
def readyz():
    ready = model_ready()
    return {"status": "ok" if ready else "degraded", "model": ready}
