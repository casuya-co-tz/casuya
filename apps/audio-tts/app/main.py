"""Casuya Audio-TTS routing assembly (mirrors apps/audio-stt/app/__init__.py).

Sherpa-ONNX TTS (Kiswahili `sw` + English `en` VITS voices), exposes
`/health`, `/readyz`, and `POST /v1/audio/tts`. Deployed on Railway as its own
service (own `railway.json` + `Dockerfile`), reached by the platform backend
over the private `railway.internal` network. Never exposed on Vercel.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings
from app.routes_tts import router as tts_router
from app.services.synthesize import model_ready

settings = get_settings()


def include_routers(app: FastAPI) -> None:
    app.include_router(tts_router)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0")
    include_routers(app)
    return app


app = create_app()


@app.get("/readyz")
def readyz():
    ready = model_ready()
    return {"status": "ok" if ready else "degraded", "voice_loaded": ready}
