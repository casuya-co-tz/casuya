"""Payment refunds — process a refund against the microservice."""

from __future__ import annotations

from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


def process_refund(payment_id: str, amount: float | None = None, reason: str = "") -> dict:
    client = get_payments_client()
    result = client.refund_payment(payment_id=payment_id, amount=amount, reason=reason)
    payment_cache.invalidate()
    return result