"""Casuya Audio-TTS microservice security.

Mirrors `apps/payments/app/security.py`: every endpoint requires a valid
internal X-API-Key (HMAC-compared). No webhook here (no third-party caller).
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import get_settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Reject requests without a valid internal X-API-Key header.

    No key is allowed in dev when the setting is unset; production MUST set one.
    """
    expected = get_settings().api_key
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key.strip(), expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
