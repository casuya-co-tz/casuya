"""Casuya platform -> Audio-TTS proxy submodule (no state, no DB).

Mirrors `backend/api/audio/stt.py`: inline `httpx` forwarding to the
Railway-hosted `audio-tts` microservice over `railway.internal`, guarded by
the platform auth session (Bearer). Body is deliberately a plain `Body(...)`
dict so this module has no dependency on a platform schema file — the TTS
service owns validation.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response

from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user

router = APIRouter(tags=["audio-tts"])


@router.post("/tts")
def proxy_tts(
    text: str = Body(..., min_length=1, max_length=1000),
    lang: str = Body("sw"),
    speed: float = Body(1.0, ge=0.5, le=2.0),
    current_user=Depends(get_current_user),
):
    """Forward `POST /v1/audio/tts` to the Casuya Audio-TTS microservice.

    `lang` `"sw"` (Kiswahili) + `"en"` (English) are the only two supported
    values — see the shipped voice models. Longer content is split into ≤1000
    char chunks by the client before calling this endpoint. The service
    synthesizes to WAV and returns it with an immutable cache header; the
    platform forwards that response to the student's `<audio>` element.
    """
    if lang not in {"sw", "en"}:
        raise HTTPException(status_code=422, detail="lang must be 'sw' or 'en'")

    settings = get_settings()
    target = settings.casuya_audio_tts_url.rstrip("/")
    url = f"{target}/v1/audio/tts"
    headers: dict[str, str] = {}
    if settings.casuya_audio_tts_api_key:
        headers["X-API-Key"] = settings.casuya_audio_tts_api_key
    body = {"user_id": current_user.get("sub"), "text": text, "lang": lang, "speed": speed}

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"audio-tts unavailable: {exc}") from exc

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "audio/wav"),
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "X-Audio-Lang": lang,
        },
    )
