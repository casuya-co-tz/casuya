"""STT routes for the Casuya Audio-STT microservice.

`GET /health` is open (like the TTS service) so Railway can probe it; the
transcribe endpoint is `POST /v1/audio/stt` (short, bounded utterances; mono
16-bit PCM WAV as recorded by the platform `MediaRecorder`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.security import require_api_key
from app.services.transcribe import transcribe_wav

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "casuya-audio-stt"}


@router.post("/v1/audio/stt")
def stt(audio: UploadFile = File(...), _auth: None = Depends(require_api_key)):  # noqa: B008
    wav = audio.file.read()
    try:
        text = transcribe_wav(wav)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"text": text}
