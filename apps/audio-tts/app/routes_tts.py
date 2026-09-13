"""TTS routes for the Casuya Audio-TTS microservice.

Mirrors `apps/payments/app/routes_misc.py`: health + audit + stats endpoints
guarded by the internal API key. TTS-specific endpoint is `POST /v1/audio/tts`.
"""

from __future__ import annotations

from starlette.responses import Response

from fastapi import APIRouter, Depends

from app.schemas import TtsPayload
from app.security import require_api_key
from app.services.synthesize import text_to_wav

router = APIRouter()


@router.get("/health")
def health(_auth: None = Depends(require_api_key)):
    return {"status": "ok", "service": "casuya-audio-tts"}


@router.post("/v1/audio/tts")
def tts(payload: TtsPayload, _auth: None = Depends(require_api_key)):
    wav = text_to_wav(payload.text, lang=payload.lang)
    return Response(
        content=wav,
        media_type="audio/wav",
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "X-Audio-Lang": payload.lang,
        },
    )
