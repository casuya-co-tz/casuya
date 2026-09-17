"""Unit tests for audio endpoint rate-limit identity (per-user when authed)."""

from __future__ import annotations

from backend.config.security import create_access_token
from backend.middleware.rate_limit import rate_limit_key_for_request


def _scope(headers: list[tuple[bytes, bytes]], path: str = "/v1/audio/tts") -> dict:
    return {"headers": headers, "path": path}


def test_rate_limit_uses_user_id_for_audio_when_bearer_present():
    token = create_access_token("user-abc-123", extra_claims={"role": "student"})
    scope = _scope([(b"authorization", f"Bearer {token}".encode())])
    key = rate_limit_key_for_request(scope, "10.0.0.1")
    assert key == "rate_limit:user:user-abc-123:/v1/audio/tts"


def test_rate_limit_falls_back_to_ip_without_token():
    scope = _scope([], path="/v1/audio/stt")
    key = rate_limit_key_for_request(scope, "203.0.113.5")
    assert key == "rate_limit:203.0.113.5:/v1/audio/stt"


def test_rate_limit_uses_ip_for_non_audio_paths():
    token = create_access_token("user-xyz", extra_claims={"role": "student"})
    scope = _scope([(b"authorization", f"Bearer {token}".encode())], path="/lessons")
    key = rate_limit_key_for_request(scope, "10.0.0.1")
    assert key == "rate_limit:10.0.0.1:/lessons"
