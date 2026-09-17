"""Casuya Math OCR routing assembly (mirrors apps/audio-stt/app/__init__.py).

Exposes `GET /health`, `GET /readyz`, and `POST /v1/ocr/recognize`
(Pix2Text math OCR). Deployed on Railway as its own service (own
`railway.json` + `Dockerfile`), reached by the platform backend over the
private `railway.internal` network. Never exposed on Vercel.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes_ocr import router as ocr_router
from app.services.recognize import model_ready

settings = get_settings()


def include_routers(app: FastAPI) -> None:
    app.include_router(ocr_router)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0")
    app.add_middleware(RateLimitMiddleware)
    include_routers(app)
    return app


app = create_app()


@app.get("/readyz")
def readyz():
    ready = model_ready()
    return {"status": "ok" if ready else "degraded", "model_loaded": ready}
