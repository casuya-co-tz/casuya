"""Casuya Audio-STT transcription engine (Sherpa-ONNX Whisper, baked at build).

Mirrors `apps/audio-tts/app/services/synthesize.py`: lazily loads the engine so
`/health` and `/readyz` stay up during rolling Railway deploys. The Whisper
multilingual model (Kiswahili `sw` + English + 90 more languages) is baked into
the image at build time (see the Dockerfile); at boot we import the Python
package and point it at the ONNX files on disk.
"""

from __future__ import annotations

import io
import wave
from typing import Any

import numpy as np
from app.config import get_settings

# Recognizers keyed by language hint: "" = auto-detect, "sw", "en".
_recognizers: dict[str, Any] = {}

# Supported Whisper sizes (must match Dockerfile bake).
_WHISPER_LAYOUT: dict[str, tuple[str, str]] = {
    "base": ("sherpa-onnx-whisper-base", "base"),
    "small": ("sherpa-onnx-whisper-small", "small"),
}


def _resolve_language(language: str | None) -> str:
    """Map client hint to Sherpa Whisper language code (empty = auto)."""
    if language in ("sw", "en"):
        return language
    return ""


def _model_paths() -> tuple[str, str, str]:
    settings = get_settings()
    size = settings.whisper_model if settings.whisper_model in _WHISPER_LAYOUT else "small"
    model_dir, prefix = _WHISPER_LAYOUT[size]
    base = f"{settings.asr_models_dir.rstrip('/')}/{model_dir}"
    return (
        f"{base}/{prefix}-encoder.int8.onnx",
        f"{base}/{prefix}-decoder.int8.onnx",
        f"{base}/{prefix}-tokens.txt",
    )


def _load_recognizer(language: str = "") -> Any:
    lang_key = language or "auto"
    if lang_key in _recognizers:
        return _recognizers[lang_key]

    import sherpa_onnx  # type: ignore[import-not-found]

    encoder, decoder, tokens = _model_paths()
    recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=encoder,
        decoder=decoder,
        tokens=tokens,
        num_threads=2,
        decoding_method="greedy_search",
        # Forcing `sw`/`en` improves accuracy vs auto-detect in bilingual classrooms.
        language=language,
        task="transcribe",
        tail_paddings=-1,
    )
    _recognizers[lang_key] = recognizer
    return recognizer


def _normalize_samples(samples: np.ndarray) -> np.ndarray:
    """Boost quiet classroom mics and limit clipping before Whisper."""
    if samples.size == 0:
        return samples
    peak = float(np.max(np.abs(samples)))
    if peak < 1e-6:
        return samples
    if peak > 0.95:
        return samples * (0.95 / peak)
    if peak < 0.15:
        gain = min(0.75 / peak, 12.0)
        return np.clip(samples * gain, -1.0, 1.0)
    return samples


def _wav_to_float32(pcm16_wav: bytes) -> tuple[np.ndarray, int]:
    """Parse a mono 16-bit PCM WAV into [-1, 1] float32 samples + its rate.

    Raises `ValueError` when the blob is not a playable mono 16-bit WAV.
    """
    try:
        with wave.open(io.BytesIO(pcm16_wav), "rb") as wf:
            if wf.getnchannels() != 1:
                raise ValueError("audio must be mono")
            if wf.getsampwidth() != 2:
                raise ValueError("audio must be 16-bit PCM")
            frames = wf.readframes(wf.getnframes())
            sample_rate = wf.getframerate()
    except wave.Error as exc:
        raise ValueError("audio is not a valid WAV file") from exc
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    return samples, sample_rate


def transcribe_wav(pcm16_wav: bytes, language: str | None = None) -> str:
    """Transcribe a mono 16-bit PCM WAV blob to text (Kiswahili/English)."""
    samples, sample_rate = _wav_to_float32(pcm16_wav)
    if samples.size == 0:
        return ""

    samples = _normalize_samples(samples)
    lang = _resolve_language(language)
    recognizer = _load_recognizer(lang)
    stream = recognizer.create_stream()
    # sherpa-onnx resamples internally to the model's 16 kHz expectation.
    stream.accept_waveform(sample_rate, samples)
    recognizer.decode_streams([stream])
    return stream.result.text.strip()


def model_ready() -> bool:
    try:
        _load_recognizer("")
        return True
    except Exception:
        return False
