"""Tests for the platform → casuya-ai HTTP bridge."""

from __future__ import annotations

import pytest
import httpx

from backend.services.ai_bridge.client import (
    AiServiceError,
    _call_ai_service,
    get_casuya_ai_url,
    reset_ai_circuit_breaker,
)


class _FakeClient:
    def __init__(self, responder):
        self._responder = responder
        self.is_closed = False

    async def post(self, url, json, headers):
        return await self._responder(url, json, headers)


@pytest.mark.asyncio
async def test_call_ai_service_success(monkeypatch):
    async def responder(url, json, headers):
        assert url.endswith("/api/content/analyze")
        assert headers.get("X-Request-Id")
        return httpx.Response(200, json={"wordCount": 3, "charCount": 10})

    async def fake_get_client():
        return _FakeClient(responder)

    monkeypatch.setattr("backend.services.ai_bridge.client._get_http_client", fake_get_client)
    monkeypatch.setattr(
        "backend.config.settings.get_settings",
        lambda: type("S", (), {"casuya_ai_url": "http://ai.test", "casuya_ai_api_key": "secret"})(),
    )

    result = await _call_ai_service("/api/content/analyze", {"content": "hello world"})
    assert result["wordCount"] == 3


@pytest.mark.asyncio
async def test_call_ai_service_raises_on_http_error(monkeypatch):
    async def responder(url, json, headers):
        return httpx.Response(503, json={"error": "AI provider temporarily unavailable"})

    async def fake_get_client():
        return _FakeClient(responder)

    monkeypatch.setattr("backend.services.ai_bridge.client._get_http_client", fake_get_client)
    monkeypatch.setattr(
        "backend.config.settings.get_settings",
        lambda: type("S", (), {"casuya_ai_url": "http://ai.test", "casuya_ai_api_key": None})(),
    )

    with pytest.raises(AiServiceError, match="503"):
        await _call_ai_service("/api/questions/generate", {"content": "x"})


@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_failures(monkeypatch):
    reset_ai_circuit_breaker()

    async def responder(url, json, headers):
        return httpx.Response(503, json={"error": "down"})

    async def fake_get_client():
        return _FakeClient(responder)

    monkeypatch.setattr("backend.services.ai_bridge.client._get_http_client", fake_get_client)
    monkeypatch.setattr(
        "backend.config.settings.get_settings",
        lambda: type("S", (), {"casuya_ai_url": "http://ai.test", "casuya_ai_api_key": None})(),
    )

    for _ in range(3):
        with pytest.raises(AiServiceError):
            await _call_ai_service("/api/tutoring/explain", {"question": "x"})

    with pytest.raises(AiServiceError, match="circuit breaker"):
        await _call_ai_service("/api/tutoring/explain", {"question": "x"})

    reset_ai_circuit_breaker()


def test_get_casuya_ai_url_from_settings(monkeypatch):
    monkeypatch.setattr(
        "backend.config.settings.get_settings",
        lambda: type("S", (), {"casuya_ai_url": "http://localhost:3000/"})(),
    )
    assert get_casuya_ai_url() == "http://localhost:3000"
