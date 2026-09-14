"""Smoke tests for the Casuya Audio-STT microservice.

These stub the Sherpa-ONNX Whisper recognizer so the suite runs without the
heavy `sherpa-onnx` wheel or the baked-in model. Run from this file's dir with:

    pip install -r ../requirements.txt
    pytest tests

The full on-disk recognizer (OfflineRecognizer.from_whisper + baked model) is
exercised in the Docker build / on Railway; see the Dockerfile.
"""

from __future__ import annotations

import io
import wave
from types import SimpleNamespace

import app.services.transcribe as transcribe
import numpy as np
import pytest
from app import app as fastapi_app
from app.config import get_settings
from fastapi.testclient import TestClient

client = TestClient(fastapi_app)


def _make_wav(duration_s: float = 0.5, rate: int = 16000) -> bytes:
    t = np.arange(int(rate * duration_s), dtype=np.float32)
    pcm = (np.sin(2 * np.pi * 440 * t / rate) * 8000).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


class _FakeRecognizer:
    def create_stream(self):
        return SimpleNamespace(
            accept_waveform=lambda sample_rate, samples: None,
            result=SimpleNamespace(text="habari, hujambo"),
        )

    def decode_streams(self, streams):
        pass


@pytest.fixture(autouse=True)
def _stub_recognizer(monkeypatch):
    get_settings.cache_clear()
    transcribe._recognizer = None
    monkeypatch.setattr(transcribe, "_load_recognizer", lambda: _FakeRecognizer())


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "casuya-audio-stt"


def test_readyz():
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["model"] is True


def test_transcribe_returns_text():
    r = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", _make_wav(), "audio/wav")},
    )
    assert r.status_code == 200
    assert r.json()["text"] == "habari, hujambo"


def test_rejects_non_wav_bytes():
    r = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", b"this is not a wav file", "audio/wav")},
    )
    assert r.status_code == 400


def test_empty_audio_returns_empty_text():
    assert transcribe.transcribe_wav(_make_wav(0.0)) == ""


def test_api_key_required_when_set(monkeypatch):
    monkeypatch.setenv("API_KEY", "secret-key")
    get_settings.cache_clear()
    r = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", _make_wav(), "audio/wav")},
    )
    assert r.status_code == 401
    r = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", _make_wav(), "audio/wav")},
        headers={"X-API-Key": "secret-key"},
    )
    assert r.status_code == 200
