"""TTS routes for the Casuya Audio-TTS microservice.

`/health` is deliberately open (no API key) so Railway's healthcheck can probe
it; only `POST /v1/audio/tts` requires the internal `X-API-Key`. The engine
speaks Kiswahili (`sw`) and English (`en`) — the only two `lang` values shipped.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.schemas import TtsPayload
from app.security import require_api_key
from app.services.synthesize import text_to_wav

router = APIRouter()


@router.get("/health")
def health():
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
