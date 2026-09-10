"""Health and readiness endpoints for the FastAPI entrypoint."""

from __future__ import annotations

from fastapi import FastAPI

from backend.config.settings import get_settings

settings = get_settings()


def add_health_routes(app: FastAPI) -> None:
    @app.get("/health")
    def health_check():
        from backend.services.email_service import smtp_configured
        from backend.startup import check_casuya_ai

        ai = check_casuya_ai()
        return {
            "status": "ok",
            "environment": settings.environment,
            "smtp_configured": smtp_configured(),
            "casuya_ai": ai,
        }

    @app.get("/readyz")
    def readiness_check():
        from backend.startup import readiness_status

        return readiness_status()