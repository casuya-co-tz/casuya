"""API key enforcement."""

from __future__ import annotations


def test_checkout_requires_api_key(client):
    resp = client.post(
        "/checkout",
        json={"amount": 1000, "mobile_number": "0712345678", "provider": "m-pesa"},
    )
    assert resp.status_code == 401


def test_payments_list_requires_api_key(client):
    assert client.get("/payments").status_code == 401
