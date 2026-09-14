"""Casuya Audio-STT transcription engine (Sherpa-ONNX Whisper, baked at build).

Mirrors `apps/audio-tts/app/services/synthesize.py`: lazily loads the engine so
`/health` and `/readyz` stay up during rolling Railway deploys. The Whisper-base
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

# One recognizer (shared by all requests) — Whisper is stateless per stream.
_recognizer: Any = None

# Layout under `settings.asr_models_dir` (from the Dockerfile bake):
#   sherpa-onnx-whisper-base/base-encoder.int8.onnx
#   sherpa-onnx-whisper-base/base-decoder.int8.onnx
#   sherpa-onnx-whisper-base/base-tokens.txt
_MODEL_DIR = "sherpa-onnx-whisper-base"


def _load_recognizer() -> Any:
    global _recognizer
    if _recognizer is None:
        import sherpa_onnx  # type: ignore[import-not-found]

        base = f"{get_settings().asr_models_dir.rstrip('/')}/{_MODEL_DIR}"
        _recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=f"{base}/base-encoder.int8.onnx",
            decoder=f"{base}/base-decoder.int8.onnx",
            tokens=f"{base}/base-tokens.txt",
            num_threads=2,
            decoding_method="greedy_search",
            # Empty language lets Whisper auto-detect Kiswahili vs English.
            language="",
            task="transcribe",
            tail_paddings=-1,
        )
    return _recognizer


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


def transcribe_wav(pcm16_wav: bytes) -> str:
    """Transcribe a mono 16-bit PCM WAV blob to text (Kiswahili/English)."""
    samples, sample_rate = _wav_to_float32(pcm16_wav)
    if samples.size == 0:
        return ""

    recognizer = _load_recognizer()
    stream = recognizer.create_stream()
    # sherpa-onnx resamples internally to the model's 16 kHz expectation.
    stream.accept_waveform(sample_rate, samples)
    recognizer.decode_streams([stream])
    return stream.result.text.strip()


def model_ready() -> bool:
    try:
        _load_recognizer()
        return True
    except Exception:
        return False
