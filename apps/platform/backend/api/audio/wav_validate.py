"""Shared WAV bounds for the platform STT proxy (mirrors audio-stt service)."""

from __future__ import annotations

import io
import wave

MAX_WAV_BYTES = 1_048_576
MAX_DURATION_S = 30.0


def validate_wav(pcm16_wav: bytes) -> None:
    if len(pcm16_wav) > MAX_WAV_BYTES:
        raise ValueError("audio exceeds 1 MB limit")
    try:
        with wave.open(io.BytesIO(pcm16_wav), "rb") as wf:
            if wf.getnchannels() != 1:
                raise ValueError("audio must be mono")
            if wf.getsampwidth() != 2:
                raise ValueError("audio must be 16-bit PCM")
            frames = wf.getnframes()
            sample_rate = wf.getframerate()
    except wave.Error as exc:
        raise ValueError("audio is not a valid WAV file") from exc
    if sample_rate and frames / sample_rate > MAX_DURATION_S:
        raise ValueError("audio exceeds 30 second limit")
