"""Webhook signature and platform-forwarded callbacks."""

from __future__ import annotations

import hashlib
import hmac
import json


def test_webhook_accepts_platform_forward(client, auth_headers):
    checkout = client.post(
        "/checkout",
        json={
            "amount": 1000,
            "mobile_number": "0712345678",
            "provider": "m-pesa",
            "idempotency_key": "webhook-test-1",
        },
        headers=auth_headers,
    ).json()

    payload = {
        "status": "completed",
        "external_id": checkout["id"],
        "reference": checkout.get("provider_reference") or checkout["id"],
    }
    resp = client.post("/webhook", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["matched"] is True
    assert resp.json()["status"] == "success"


def test_webhook_rejects_unsigned_when_secret_set(client, auth_headers, monkeypatch):
    monkeypatch.setenv("AZAMPAY_MOCK", "false")
    monkeypatch.setenv("AZAMPAY_WEBHOOK_SECRET", "wh-secret")
    from app.config import get_settings

    get_settings.cache_clear()

    body = json.dumps({"status": "completed", "reference": "missing"}).encode()
    sig = hmac.new(b"wh-secret", body, hashlib.sha256).hexdigest()
    ok = client.post("/webhook", content=body, headers={"X-Signature": sig})
    assert ok.status_code == 200

    bad = client.post("/webhook", content=body, headers={"X-Signature": "bad"})
    assert bad.status_code == 401
