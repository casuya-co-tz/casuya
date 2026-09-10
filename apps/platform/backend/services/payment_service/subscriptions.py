"""Payment subscriptions — write operations against the microservice."""

from __future__ import annotations

from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


def create_subscription(user_id: str, plan_id: str, amount: float) -> dict:
    client = get_payments_client()
    result = client.create_subscription(user_id=user_id, plan_id=plan_id, amount=amount)
    payment_cache.invalidate()
    return result


def cancel_subscription(subscription_id: str, immediate: bool = False, user_id: str | None = None) -> dict:
    client = get_payments_client()
    result = client.cancel_subscription(subscription_id=subscription_id, immediate=immediate, user_id=user_id)
    payment_cache.invalidate()
    return result