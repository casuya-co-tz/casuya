"""Payment service — reads from in-memory cache (<1ms), writes to microservice.

The microservice (SQLite) is the single source of truth.
The in-memory cache serves all read operations instantly.
After writes, cache is immediately refreshed.

When the casuya-payments microservice is unreachable (e.g. local dev without
it running), checkout falls back to a direct AzamPay integration so payments
still work.
"""

from __future__ import annotations

from backend.services.payment_service.checkout import initiate_checkout
from backend.services.payment_service.invoices import get_invoice, pay_invoice
from backend.services.payment_service.plans import (
    create_plan,
    delete_plan,
    get_plan,
    list_plans,
    pay_plan,
    update_plan,
)
from backend.services.payment_service.reader import (
    get_user_payment_stats,
    list_all_payments,
    list_user_invoices,
    list_user_payments,
    list_user_refunds,
    list_user_subscriptions,
)
from backend.services.payment_service.refunds import process_refund
from backend.services.payment_service.subscriptions import cancel_subscription, create_subscription
from backend.services.payment_service.webhooks import handle_webhook_payload

__all__ = [
    "cancel_subscription",
    "create_plan",
    "create_subscription",
    "delete_plan",
    "get_invoice",
    "get_plan",
    "get_user_payment_stats",
    "handle_webhook_payload",
    "initiate_checkout",
    "list_all_payments",
    "list_plans",
    "list_user_invoices",
    "list_user_payments",
    "list_user_refunds",
    "list_user_subscriptions",
    "pay_invoice",
    "pay_plan",
    "process_refund",
    "update_plan",
]