"""STT routes for the Casuya Audio-STT microservice.

`GET /health` is open (like the TTS service) so Railway can probe it; the
transcribe endpoint is `POST /v1/audio/stt` (short, bounded utterances; mono
16-bit PCM WAV as recorded by the platform `MediaRecorder`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.security import require_api_key
from app.services.transcribe import transcribe_wav
from app.services.wav_validate import validate_wav

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "casuya-audio-stt"}


@router.post("/v1/audio/stt")
def stt(
    audio: UploadFile = File(...),  # noqa: B008
    language: str | None = Form(default=None),
    _auth: None = Depends(require_api_key),
):
    wav = audio.file.read()
    lang = language if language in ("sw", "en") else None
    try:
        validate_wav(wav)
        text = transcribe_wav(wav, language=lang)
    except ValueError as exc:
        detail = str(exc)
        status = 413 if "1 MB" in detail else 400
        raise HTTPException(status_code=status, detail=detail) from exc
    return {"text": text}
