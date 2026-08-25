"""Payment service — reads from in-memory cache (<1ms), writes to microservice.

The microservice (SQLite) is the single source of truth.
The in-memory cache serves all read operations instantly.
After writes, cache is immediately refreshed.
"""

from __future__ import annotations

from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


def initiate_checkout(
    user_id: str, amount_tzs: float, mobile_number: str, provider: str, idempotency_key: str | None = None
) -> dict:
    client = get_payments_client()
    result = client.checkout(
        amount=amount_tzs,
        mobile_number=mobile_number,
        provider=provider,
        user_id=user_id,
        idempotency_key=idempotency_key,
    )
    payment_cache.invalidate()
    return result


def handle_webhook_payload(payload: dict) -> dict:
    client = get_payments_client()
    result = client.webhook(payload)
    payment_cache.invalidate()
    return result


def list_user_payments(user_id: str) -> list[dict]:
    return payment_cache.get_payments(user_id=user_id)


def list_all_payments() -> list[dict]:
    return payment_cache.get_all_payments()


def get_user_payment_stats(user_id: str) -> dict:
    return payment_cache.get_stats(user_id=user_id)


# ── Subscriptions ────────────────────────────────────────────────────────


def list_user_subscriptions(user_id: str) -> list[dict]:
    return payment_cache.get_subscriptions(user_id=user_id)


def create_subscription(user_id: str, plan_id: str, amount: float) -> dict:
    client = get_payments_client()
    result = client.create_subscription(user_id=user_id, plan_id=plan_id, amount=amount)
    payment_cache.invalidate()
    return result


def cancel_subscription(subscription_id: str, immediate: bool = False) -> dict:
    client = get_payments_client()
    result = client.cancel_subscription(subscription_id=subscription_id, immediate=immediate)
    payment_cache.invalidate()
    return result


# ── Invoices ─────────────────────────────────────────────────────────────


def list_user_invoices(user_id: str) -> list[dict]:
    return payment_cache.get_invoices(user_id=user_id)


def get_invoice(invoice_id: str) -> dict:
    client = get_payments_client()
    return client.get_invoice(invoice_id=invoice_id)


def pay_invoice(invoice_id: str) -> dict:
    client = get_payments_client()
    result = client.pay_invoice(invoice_id=invoice_id)
    payment_cache.invalidate()
    return result


# ── Refunds ──────────────────────────────────────────────────────────────


def process_refund(payment_id: str, amount: float | None = None, reason: str = "") -> dict:
    client = get_payments_client()
    result = client.refund_payment(payment_id=payment_id, amount=amount, reason=reason)
    payment_cache.invalidate()
    return result


def list_user_refunds(user_id: str) -> list[dict]:
    return payment_cache.get_refunds(user_id=user_id)
