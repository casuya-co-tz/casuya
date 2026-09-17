"""Stats endpoint uses SQL aggregates, not full-table loads."""

from __future__ import annotations


def test_stats_empty(client, auth_headers):
    resp = client.get("/stats", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_payments"] == 0
    assert body["completed_payments"] == 0
    assert body["total_revenue"] == 0


def test_stats_after_checkout(client, auth_headers):
    client.post(
        "/checkout",
        json={"amount": 3000, "mobile_number": "0712345678", "provider": "m-pesa"},
        headers=auth_headers,
    )
    body = client.get("/stats", headers=auth_headers).json()
    assert body["total_payments"] >= 1
    assert body["completed_payments"] >= 1
    assert body["total_revenue"] >= 3000
