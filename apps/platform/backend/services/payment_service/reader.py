"""Payment read operations — thin in-memory cache accessors."""

from __future__ import annotations

from backend.services import payment_cache


def list_user_payments(user_id: str) -> list[dict]:
    return payment_cache.get_payments(user_id=user_id)


def list_all_payments() -> list[dict]:
    return payment_cache.get_all_payments()


def get_user_payment_stats(user_id: str) -> dict:
    return payment_cache.get_stats(user_id=user_id)


def list_user_subscriptions(user_id: str) -> list[dict]:
    return payment_cache.get_subscriptions(user_id=user_id)


def list_user_invoices(user_id: str) -> list[dict]:
    return payment_cache.get_invoices(user_id=user_id)


def list_user_refunds(user_id: str) -> list[dict]:
    return payment_cache.get_refunds(user_id=user_id)