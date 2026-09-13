"""Casuya Audio-TTS �?" Piper synthesis engine (loaded at build, run at boot).

Piper runs fully offline inside this service; the Kiswahili (`sw`) + English
voice models were `git clone`d from `rhasspy/piper-voices` and baked into the
Docker image at build time (see The Dockerfile). At runtime we only import the
Python package + point it at the ONNX voice files on disk.
"""

from __future__ import annotations

import wave
from io import BytesIO

from app.config import get_settings

# Imported lazily so `/health` stays green even if the onnx runtime package is
# mid-install during a rolling Railway deploy.
_piper = None


def _load_engine():
    global _piper
    if _piper is None:
        from piper import PiperVoice  # type: ignore[import-not-found]

        settings = get_settings()
        _piper = PiperVoice.load(settings.piper_voice_path)
    return _piper


def text_to_wav(text: str, lang: str | None = None) -> bytes:
    """Synthesize `text` to PCM-in-WAV bytes (16-bit mono 22050 Hz).

    `lang` is accepted for API parity with the STT side, but the engine uses
    the voice model baked into the image (the browser chooses which service URL
    to call based on the student's locale).
    """
    voice = _load_engine()
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        voice.synthesize(text, wf)
    return buf.getvalue()


def model_ready() -> bool:
    try:
        _load_engine()
        return True
    except Exception:
        return False
