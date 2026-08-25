"""Casuya Payments client wrapper for the platform.

Provides a typed interface to the casuya-payments microservice.
Raises ConnectionError when the service is unavailable.
"""

from __future__ import annotations

import httpx

from backend.config.settings import get_settings


class PaymentsClient:
    """HTTP client for the casuya-payments microservice."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.casuya_payments_url.rstrip("/")
        self.http = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(connect=2.0, read=5.0, write=5.0, pool=2.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    def _get(self, path: str, params: dict | None = None) -> dict | list:
        try:
            resp = self.http.get(path, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.ConnectError:
            raise ConnectionError(f"casuya-payments service unavailable at {self.base_url}")
        except httpx.TimeoutException:
            raise ConnectionError(f"casuya-payments service timeout at {self.base_url}")

    def _post(self, path: str, json: dict | None = None) -> dict:
        try:
            resp = self.http.post(path, json=json)
            resp.raise_for_status()
            return resp.json()
        except httpx.ConnectError:
            raise ConnectionError(f"casuya-payments service unavailable at {self.base_url}")
        except httpx.TimeoutException:
            raise ConnectionError(f"casuya-payments service timeout at {self.base_url}")

    # ── Payments ──────────────────────────────────────────────────────────

    def list_payments(
        self, user_id: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0
    ) -> list[dict]:
        params: dict = {"limit": limit, "offset": offset}
        if user_id:
            params["user_id"] = user_id
        if status:
            params["status"] = status
        return self._get("/payments", params=params)

    def get_payment(self, payment_id: str) -> dict:
        return self._get(f"/payments/{payment_id}")

    def create_payment(
        self,
        user_id: str,
        amount: float,
        currency: str = "TZS",
        provider: str = "azampay",
        metadata: dict | None = None,
    ) -> dict:
        return self._post(
            "/payments",
            json={
                "user_id": user_id,
                "amount": amount,
                "currency": currency,
                "provider": provider,
                "metadata": metadata or {},
            },
        )

    def process_payment(self, payment_id: str) -> dict:
        return self._post(f"/payments/{payment_id}/process")

    def refund_payment(self, payment_id: str, amount: float | None = None, reason: str = "") -> dict:
        return self._post(
            f"/payments/{payment_id}/refund",
            json={
                "amount": amount,
                "reason": reason,
            },
        )

    def cancel_payment(self, payment_id: str) -> dict:
        return self._post(f"/payments/{payment_id}/cancel")

    # ── Checkout (AzamPay) ────────────────────────────────────────────────

    def checkout(
        self,
        amount: float,
        mobile_number: str,
        provider: str = "m-pesa",
        user_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        return self._post(
            "/checkout",
            json={
                "amount": amount,
                "mobile_number": mobile_number,
                "provider": provider,
                "user_id": user_id,
                "idempotency_key": idempotency_key,
            },
        )

    def webhook(self, payload: dict) -> dict:
        return self._post("/webhook", json=payload)

    # ── Subscriptions ─────────────────────────────────────────────────────

    def list_subscriptions(self, user_id: str | None = None) -> list[dict]:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        return self._get("/subscriptions", params=params)

    def get_subscription(self, subscription_id: str) -> dict:
        return self._get(f"/subscriptions/{subscription_id}")

    def create_subscription(self, user_id: str, plan_id: str, amount: float, currency: str = "TZS") -> dict:
        return self._post(
            "/subscriptions",
            json={
                "user_id": user_id,
                "plan_id": plan_id,
                "amount": amount,
                "currency": currency,
            },
        )

    def cancel_subscription(self, subscription_id: str, immediate: bool = False) -> dict:
        return self._post(
            f"/subscriptions/{subscription_id}/cancel",
            json={
                "immediate": immediate,
            },
        )

    def pause_subscription(self, subscription_id: str) -> dict:
        return self._post(f"/subscriptions/{subscription_id}/pause")

    def resume_subscription(self, subscription_id: str) -> dict:
        return self._post(f"/subscriptions/{subscription_id}/resume")

    # ── Invoices ──────────────────────────────────────────────────────────

    def list_invoices(self, user_id: str | None = None, status: str | None = None) -> list[dict]:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        if status:
            params["status"] = status
        return self._get("/invoices", params=params)

    def get_invoice(self, invoice_id: str) -> dict:
        return self._get(f"/invoices/{invoice_id}")

    def create_invoice(
        self,
        user_id: str,
        amount: float,
        currency: str = "TZS",
        tax_amount: float = 0,
        discount_amount: float = 0,
        items: list[dict] | None = None,
        due_date: str | None = None,
    ) -> dict:
        return self._post(
            "/invoices",
            json={
                "user_id": user_id,
                "amount": amount,
                "currency": currency,
                "tax_amount": tax_amount,
                "discount_amount": discount_amount,
                "items": items or [],
                "due_date": due_date,
            },
        )

    def pay_invoice(self, invoice_id: str) -> dict:
        return self._post(f"/invoices/{invoice_id}/pay")

    # ── Refunds ───────────────────────────────────────────────────────────

    def list_refunds(self, user_id: str | None = None) -> list[dict]:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        return self._get("/refunds", params=params)

    # ── Billing ───────────────────────────────────────────────────────────

    def list_billing(self, user_id: str | None = None) -> list[dict]:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        return self._get("/billing", params=params)

    # ── Audit ─────────────────────────────────────────────────────────────

    def list_audit_logs(self, user_id: str | None = None) -> list[dict]:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        return self._get("/audit", params=params)

    # ── Stats ─────────────────────────────────────────────────────────────

    def get_stats(self, user_id: str | None = None) -> dict:
        params: dict = {}
        if user_id:
            params["user_id"] = user_id
        return self._get("/stats", params=params)

    def close(self):
        self.http.close()


_client: PaymentsClient | None = None


def get_payments_client() -> PaymentsClient:
    """Return a shared PaymentsClient instance (reuses TCP connections)."""
    global _client
    if _client is None:
        _client = PaymentsClient()
    return _client
