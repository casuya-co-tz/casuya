"""Platform proxy tests for /v1/audio/tts and /v1/audio/stt."""

from __future__ import annotations

import io
import wave
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def _register_token(email: str = "audio-student@test.com") -> str:
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "test123",
            "full_name": "Audio Student",
            "role": "student",
        },
    )
    login = client.post("/auth/login", json={"email": email, "password": "test123"})
    return login.json()["access_token"]


def _make_wav(duration_s: float = 0.25, rate: int = 16000) -> bytes:
    t = np.arange(int(rate * duration_s), dtype=np.float32)
    pcm = (np.sin(2 * np.pi * 440 * t / rate) * 8000).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def test_tts_requires_auth():
    resp = client.post("/v1/audio/tts", json={"text": "Habari", "lang": "sw"})
    assert resp.status_code == 401


def test_tts_rejects_invalid_lang():
    token = _register_token("audio-lang@test.com")
    resp = client.post(
        "/v1/audio/tts",
        json={"text": "Hello", "lang": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_tts_rejects_oversized_text():
    token = _register_token("audio-long@test.com")
    resp = client.post(
        "/v1/audio/tts",
        json={"text": "x" * 1001, "lang": "sw"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@patch("backend.api.audio.tts.httpx.Client")
def test_tts_proxy_forwards_request(mock_client_cls):
    token = _register_token("audio-tts-proxy@test.com")
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"RIFFwav"
    mock_resp.headers = {"content-type": "audio/wav"}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    resp = client.post(
        "/v1/audio/tts",
        json={"text": "Habari", "lang": "sw", "speed": 1.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.content == b"RIFFwav"
    assert resp.headers.get("x-audio-lang") == "sw"
    _, kwargs = mock_client.post.call_args
    assert kwargs["json"]["text"] == "Habari"
    assert kwargs["json"]["lang"] == "sw"
    assert kwargs["json"]["speed"] == 1.0


def test_stt_requires_auth():
    resp = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", _make_wav(), "audio/wav")},
    )
    assert resp.status_code == 401


@patch("backend.api.audio.stt.httpx.Client")
def test_stt_proxy_forwards_wav_and_language(mock_client_cls):
    token = _register_token("audio-stt-proxy@test.com")
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"text": "habari"}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    resp = client.post(
        "/v1/audio/stt",
        data={"language": "sw"},
        files={"audio": ("clip.wav", _make_wav(), "audio/wav")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["text"] == "habari"
    _, kwargs = mock_client.post.call_args
    assert kwargs["data"]["language"] == "sw"
    assert "audio" in kwargs["files"]


def test_stt_rejects_oversized_wav():
    token = _register_token("audio-stt-big@test.com")
    big = _make_wav(0.5) + b"x" * (1_048_576 + 1)
    resp = client.post(
        "/v1/audio/stt",
        files={"audio": ("clip.wav", big, "audio/wav")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 413
