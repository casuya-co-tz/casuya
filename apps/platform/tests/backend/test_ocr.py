"""Platform OCR proxy tests (B-04)."""

from __future__ import annotations

import base64
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.config.settings import get_settings
from backend.main import app

client = TestClient(app)

_TINY_PNG = base64.b64encode(
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82"
).decode()


def _register_token(email: str = "ocr-student@test.com") -> str:
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "test123",
            "full_name": "OCR Student",
            "role": "student",
        },
    )
    login = client.post("/auth/login", json={"email": email, "password": "test123"})
    return login.json()["access_token"]


def test_ocr_status_requires_auth():
    assert client.get("/v1/ocr/status").status_code == 401


def test_ocr_status_unconfigured(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("OCR_PROVIDER", "none")
    get_settings.cache_clear()
    token = _register_token("ocr-status@test.com")
    resp = client.get("/v1/ocr/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["available"] is False


def test_ocr_handwriting_requires_auth():
    resp = client.post("/v1/ocr/handwriting", json={"image": _TINY_PNG})
    assert resp.status_code == 401


def test_ocr_handwriting_unconfigured(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("OCR_PROVIDER", "none")
    get_settings.cache_clear()
    token = _register_token("ocr-unconfigured@test.com")
    resp = client.post(
        "/v1/ocr/handwriting",
        json={"image": _TINY_PNG},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 503


@patch("backend.api.ocr.handwriting.recognize_mathpix")
def test_ocr_handwriting_proxy_success(mock_recognize, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("OCR_PROVIDER", "mathpix")
    monkeypatch.setenv("MATHPIX_APP_ID", "test-app-id")
    monkeypatch.setenv("MATHPIX_APP_KEY", "test-app-key")
    get_settings.cache_clear()

    mock_recognize.return_value = {
        "latex": "x = 5",
        "confidence": 0.91,
        "symbols": [],
    }
    token = _register_token("ocr-success@test.com")
    resp = client.post(
        "/v1/ocr/handwriting",
        json={"image": _TINY_PNG},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["latex"] == "x = 5"
    mock_recognize.assert_called_once()

    get_settings.cache_clear()
    monkeypatch.delenv("OCR_PROVIDER", raising=False)
    monkeypatch.delenv("MATHPIX_APP_ID", raising=False)
    monkeypatch.delenv("MATHPIX_APP_KEY", raising=False)


def test_ocr_rejects_invalid_base64(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("OCR_PROVIDER", "mathpix")
    monkeypatch.setenv("MATHPIX_APP_ID", "test-app-id")
    monkeypatch.setenv("MATHPIX_APP_KEY", "test-app-key")
    get_settings.cache_clear()
    token = _register_token("ocr-invalid@test.com")
    resp = client.post(
        "/v1/ocr/handwriting",
        json={"image": "not-valid-base64!!!" + ("A" * 32)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400

    get_settings.cache_clear()
    monkeypatch.delenv("OCR_PROVIDER", raising=False)
    monkeypatch.delenv("MATHPIX_APP_ID", raising=False)
    monkeypatch.delenv("MATHPIX_APP_KEY", raising=False)
