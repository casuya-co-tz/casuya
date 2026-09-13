"""Health/readyz + audit-stub routes for the Audio-TTS microservice."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.security import require_api_key

router = APIRouter()


@router.get("/health")
def health(_auth: None = Depends(require_api_key)):
    return {"status": "ok", "service": "casuya-audio-tts"}


@router.get("/readyz")
def readyz(_auth: None = Depends(require_api_key)):
    return {"status": "ok", "voice_ready": True}
