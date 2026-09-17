"""Smoke tests for the Casuya Audio-TTS microservice.

These stub the Sherpa-ONNX engine so the suite runs without the heavy
`sherpa-onnx` wheel or the baked-in voice packs. Run from this file's dir with:

    pip install -r ../requirements.txt
    pytest tests

The full on-disk engine (sherpa_onnx.OfflineTts + voice packs) is exercised in
the Docker build / on Railway; see the Dockerfile.
"""

from __future__ import annotations

from types import SimpleNamespace

import app.services.synthesize as synth
import numpy as np
import pytest
from app.config import get_settings
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _fake_engine():
    samples = np.zeros(22050, dtype=np.float32)
    samples[0:4] = np.array([0.1, -0.2, 0.3, 0.4], dtype=np.float32)
    return SimpleNamespace(
        generate=lambda text, sid=0, speed=1.0: SimpleNamespace(
            samples=samples, sample_rate=22050
        )
    )


@pytest.fixture(autouse=True)
def _stub_engine(monkeypatch):
    get_settings.cache_clear()
    synth._engines.clear()
    monkeypatch.setattr(synth, "_load_engine", lambda lang: _fake_engine())


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "casuya-audio-tts"


def test_readyz():
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["voice_loaded"] is True


def test_tts_returns_wav():
    r = client.post("/v1/audio/tts", json={"text": "Habari", "lang": "sw"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.headers["x-audio-lang"] == "sw"
    assert "Cache-Control" in r.headers
    assert r.content[:4] == b"RIFF"


def test_tts_english_and_default_lang():
    r = client.post("/v1/audio/tts", json={"text": "Hello"})
    assert r.status_code == 200
    assert r.headers["x-audio-lang"] == "sw"


def test_rejects_unknown_lang():
    r = client.post("/v1/audio/tts", json={"text": "Hola", "lang": "fr"})
    assert r.status_code == 422


def test_rejects_text_over_1000_chars():
    r = client.post("/v1/audio/tts", json={"text": "a" * 1001, "lang": "en"})
    assert r.status_code == 422


def test_rejects_invalid_speed():
    r = client.post("/v1/audio/tts", json={"text": "Habari", "lang": "sw", "speed": 3.0})
    assert r.status_code == 422


def test_accepts_speed_param():
    r = client.post("/v1/audio/tts", json={"text": "Habari", "lang": "sw", "speed": 0.8})
    assert r.status_code == 200
    assert r.content[:4] == b"RIFF"


def test_api_key_required_when_set(monkeypatch):
    monkeypatch.setenv("API_KEY", "secret-key")
    get_settings.cache_clear()
    assert client.post("/v1/audio/tts", json={"text": "Habari"}).status_code == 401
    r = client.post(
        "/v1/audio/tts",
        json={"text": "Habari"},
        headers={"X-API-Key": "secret-key"},
    )
    assert r.status_code == 200


def test_recovers_after_env_cleared(monkeypatch):
    monkeypatch.delenv("API_KEY", raising=False)
    get_settings.cache_clear()
    assert client.post("/v1/audio/tts", json={"text": "Habari"}).status_code == 200


def test_tts_rate_limit(monkeypatch):
    import app.middleware.rate_limit as rate_limit
    from app.main import create_app

    monkeypatch.setattr(rate_limit, "ENDPOINT_LIMITS", {"/v1/audio/tts": 2})
    isolated = TestClient(create_app())
    payload = {"text": "Habari", "lang": "sw"}
    assert isolated.post("/v1/audio/tts", json=payload).status_code == 200
    assert isolated.post("/v1/audio/tts", json=payload).status_code == 200
    assert isolated.post("/v1/audio/tts", json=payload).status_code == 429
