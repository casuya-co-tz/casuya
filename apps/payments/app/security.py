"""Casuya Payments microservice — API-key auth and webhook signature helpers.

The microservice is only reachable by the platform backend, but it is deployed
on a public host, so every state-changing endpoint requires an internal API key
and the AzamPay webhook must be verified by HMAC signature.
"""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Header, HTTPException

from app.config import get_settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Reject requests without a valid internal X-API-Key header.

    No key is allowed in dev when settings.api_key is unset (mock flow keeps
    working); production deployments must configure one.
    """
    expected = get_settings().api_key
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key.strip(), expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def verify_webhook_signature(body: bytes, signature: str | None) -> None:
    """Verify an AzamPay webhook HMAC-SHA256/SHA512 signature.

    Mirrors the platform's checkout webhook: computed over the raw request body
    using the webhook secret (falling back to the client secret).
    """
    settings = get_settings()

    if settings.azampay_mock:
        return  # mock callbacks are not signed

    secret = settings.azampay_webhook_secret or settings.azampay_client_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook signature secret not configured")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    key = str(secret).encode()
    # Accept SHA-256; some AzamPay callbacks echo a SHA-512 digest too.
    expected_sha256 = hmac.new(key, body, hashlib.sha256).hexdigest()
    expected_sha512 = hmac.new(key, body, hashlib.sha512).hexdigest()
    provided = signature.strip()
    if not (hmac.compare_digest(provided, expected_sha256) or hmac.compare_digest(provided, expected_sha512)):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")