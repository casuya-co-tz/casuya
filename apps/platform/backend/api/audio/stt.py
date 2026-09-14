"""Casuya platform -> Audio-STT proxy submodule (no state, no DB).

Mirrors `backend/api/audio/tts.py`: FastAPI `APIRouter` + inline `httpx`
forwarding to the Railway-hosted `audio-stt` microservice over
`railway.internal`. Audio bytes are forwarded as-is (16 kHz PCM mono WAV,
what the student MediaRecorder produces); the service transcribes and returns
the Kiswahili/English text.
"""

from __future__ import annotations

import io

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user

router = APIRouter(tags=["audio-stt"])


@router.post("/stt", response_model=dict)
async def proxy_stt(
    audio: UploadFile = File(...),
    current_user=Depends(get_current_user),
    _lang: str | None = None,
):
    """Forward the recorded WAV to the Casuya Audio-STT microservice."""
    settings = get_settings()
    target = settings.casuya_audio_stt_url.rstrip("/")
    url = f"{target}/v1/audio/stt"
    headers: dict[str, str] = {}
    if settings.casuya_audio_stt_api_key:
        headers["X-API-Key"] = settings.casuya_audio_stt_api_key
    data = {"user_id": current_user.get("sub")}
    wav = await audio.read()

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                url,
                headers=headers,
                data=data,
                files={"audio": (audio.filename, io.BytesIO(wav), "audio/wav")},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"audio-stt unavailable: {exc}") from exc

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
