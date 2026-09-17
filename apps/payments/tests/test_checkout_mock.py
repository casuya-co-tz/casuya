"""Mock checkout flow."""

from __future__ import annotations


def test_checkout_mock_success(client, auth_headers):
    resp = client.post(
        "/checkout",
        json={
            "amount": 5000,
            "mobile_number": "0712345678",
            "provider": "m-pesa",
            "user_id": "student-1",
            "idempotency_key": "idem-abc",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["amount"] == 5000
    assert body["provider_reference"]


def test_checkout_idempotent(client, auth_headers):
    payload = {
        "amount": 2500,
        "mobile_number": "0755123456",
        "provider": "m-pesa",
        "idempotency_key": "idem-repeat",
    }
    first = client.post("/checkout", json=payload, headers=auth_headers).json()
    second = client.post("/checkout", json=payload, headers=auth_headers).json()
    assert first["id"] == second["id"]
    assert second.get("idempotent") is True
