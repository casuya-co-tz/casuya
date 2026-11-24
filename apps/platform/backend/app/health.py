"""Health and readiness endpoints for the FastAPI entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from backend.config.settings import get_settings

settings = get_settings()


def add_health_routes(app: FastAPI) -> None:
    @app.get("/health")
    def health_check():
        return {"status": "ok"}

    @app.get("/readyz")
    def readiness_check():
        from backend.startup import readiness_status

        status = readiness_status()
        settings = get_settings()
        # A broken primary DB makes the API nonfunctional regardless of the
        # startup flag, so readiness must fail whenever the probe fails.
        if not status.get("database"):
            return JSONResponse(status_code=503, content=status)
        if settings.require_redis_on_ready and not status.get("redis"):
            return JSONResponse(status_code=503, content=status)
        return status
