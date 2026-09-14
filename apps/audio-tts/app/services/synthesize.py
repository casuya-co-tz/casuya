"""Casuya Audio-TTS synthesis engine (Sherpa-ONNX OfflineTts, baked at build).

Mirrors `apps/audio-stt/app/services/transcribe.py`: lazily loads the engine so
`/health` and `/readyz` stay up during rolling Railway deploys. The Kiswahili
(`sw`) + English (`en`) VITS voice packs are baked into the image at build time
(see the Dockerfile); at boot we import the Python package and point it at the
ONNX files on disk.
"""

from __future__ import annotations

import wave
from io import BytesIO
from typing import Any

import numpy as np
from app.config import get_settings

# Voice pack layout under `settings.sherpa_models_dir` (from the Dockerfile bake).
_VOICES: dict[str, dict[str, str]] = {
    "sw": {
        "model": "vits-piper-sw_CD-lanfrica-medium/sw_CD-lanfrica-medium.onnx",
        "tokens": "vits-piper-sw_CD-lanfrica-medium/tokens.txt",
        "data_dir": "vits-piper-sw_CD-lanfrica-medium/espeak-ng-data",
    },
    "en": {
        "model": "vits-piper-en_US-amy-low/en_US-amy-low.onnx",
        "tokens": "vits-piper-en_US-amy-low/tokens.txt",
        "data_dir": "vits-piper-en_US-amy-low/espeak-ng-data",
    },
}

# One OfflineTts instance per voice (loaded on first use, then cached).
_engines: dict[str, Any] = {}


def _load_engine(lang: str) -> Any:
    if lang not in _engines:
        import sherpa_onnx  # type: ignore[import-not-found]

        base = get_settings().sherpa_models_dir.rstrip("/")
        voice = _VOICES[lang]
        config = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=f"{base}/{voice['model']}",
                    tokens=f"{base}/{voice['tokens']}",
                    data_dir=f"{base}/{voice['data_dir']}",
                    length_scale=1.0,
                    noise_scale=0.667,
                    noise_scale_w=0.8,
                    speaker_id=0,
                ),
                num_threads=2,
                provider="cpu",
            ),
            max_num_sentences=1,
        )
        _engines[lang] = sherpa_onnx.OfflineTts(config)
    return _engines[lang]


def text_to_wav(text: str, lang: str = "sw") -> bytes:
    """Synthesize `text` with the `lang` voice to 16-bit PCM mono WAV bytes."""
    engine = _load_engine(lang)
    audio = engine.generate(text, sid=0, speed=1.0)
    pcm = (np.clip(audio.samples, -1.0, 1.0) * 32767).astype(np.int16)

    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(audio.sample_rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def model_ready() -> bool:
    try:
        _load_engine("sw")
        return True
    except Exception:
        return False
