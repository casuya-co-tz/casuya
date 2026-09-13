"""Casuya Audio-TTS �?" Piper TTS microservice (FastAPI).

Piper is a lightweight C++/ONNX text-to-speech engine (GitHub:
`rhasspy/piper-voices` model repo; engine `rhasspy/piper`). This service loads a
Kiswahili + English voice, exposes `/health` + `/readyz` + `/v1/audio/tts`, and
protects every endpoint with an internal `X-API-Key` (HMAC-verified, mirroring
`apps/payments/app/security.py`).

Deployed on Railway as its own service (own `railway.json` + `Dockerfile`),
reached by the platform backend over the private `railway.internal` network.
It is NEVER exposed on Vercel (Vercel hosts only the static vanilla-JS
frontend; it has no Python runtime and no `/api` handling).
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.responses import Response

from app.config import Settings, get_settings
from app.routes_misc import router as misc_router
from app.routes_tts import router as tts_router
from app.security import require_api_key

settings: Settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(app.state.piper.load)
    yield
    await asyncio.to_thread(app.state.piper.unload)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.include_router(misc_router)
    app.include_router(tts_router)
    return app


app = create_app()


@app.get("/health")
def health():
    return {"status": "ok", "service": "casuya-audio-tts", "environment": settings.environment}


@app.get("/readyz")
def readyz(_auth: None = Depends(require_api_key)):
    return {"status": "ok", "voice_loaded": app.state.piper.is_loaded()}
