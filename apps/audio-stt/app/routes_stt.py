"""STT routes for the Casuya Audio-STT microservice.

Mirrors `apps/payments/app/routes_misc.py`: health + readyz endpoints guarded
by the internal API key. The STT endpoint is `POST /v1/audio/stt` (short,
bounded utterances; 16 kHz PCM mono WAV via the platform `MediaRecorder`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.security import require_api_key
from app.services.transcribe import transcribe_wav

router = APIRouter()


@router.get("/health")
def health(_auth: None = Depends(require_api_key)):
    return {"status": "ok", "service": "casuya-audio-stt"}


@router.post("/v1/audio/stt")
def stt(audio: UploadFile = File(...), _auth: None = Depends(require_api_key)):
    wav = audio.file.read()
    return {"text": transcribe_wav(wav)}
