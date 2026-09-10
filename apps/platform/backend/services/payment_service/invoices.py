"""Payment invoices — read and pay operations."""

from __future__ import annotations

from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


def get_invoice(invoice_id: str, user_id: str | None = None) -> dict:
    client = get_payments_client()
    return client.get_invoice(invoice_id=invoice_id, user_id=user_id)


def pay_invoice(invoice_id: str, user_id: str | None = None) -> dict:
    client = get_payments_client()
    result = client.pay_invoice(invoice_id=invoice_id, user_id=user_id)
    payment_cache.invalidate()
    return result