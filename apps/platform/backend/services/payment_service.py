"""Payment service — reads from in-memory cache (<1ms), writes to microservice.

The microservice (SQLite) is the single source of truth.
The in-memory cache serves all read operations instantly.
After writes, cache is immediately refreshed.

When the casuya-payments microservice is unreachable (e.g. local dev without
it running), checkout falls back to a direct AzamPay integration so payments
still work.
"""

from __future__ import annotations

import uuid

from backend.config.database import get_db
from backend.models.payment import Payment
from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


def initiate_checkout(
    user_id: str,
    amount_tzs: float,
    mobile_number: str,
    provider: str,
    idempotency_key: str | None = None,
    plan_id: str | None = None,
    plan_name: str | None = None,
) -> dict:
    try:
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
    except ConnectionError:
        # Microservice unreachable — fall back to direct AzamPay integration.
        return _direct_azampay_checkout(
            user_id, amount_tzs, mobile_number, provider, idempotency_key, plan_id, plan_name
        )


def _direct_azampay_checkout(
    user_id: str,
    amount_tzs: float,
    mobile_number: str,
    provider: str,
    idempotency_key: str | None,
    plan_id: str | None = None,
    plan_name: str | None = None,
) -> dict:
    """Process an AzamPay mobile checkout directly, storing a Payment record."""
    from integrations.azampay import mobile_checkout

    external_id = idempotency_key or str(uuid.uuid4())
    result = mobile_checkout(
        amount_tzs=amount_tzs,
        mobile_number=mobile_number,
        provider=provider,
        external_id=external_id,
    )

    data = result.get("data", result)
    reference = (
        data.get("reference")
        or data.get("transactionId")
        or data.get("transactionReference")
        or result.get("reference")
    )
    success = result.get("success", True) in (True, "true", "Success", "success")
    status = "success" if success else "pending"

    _gen = get_db()
    db = next(_gen)
    try:
        payment = Payment(
            user_id=user_id,
            amount_tzs=amount_tzs,
            provider="azampay",
            provider_reference=reference,
            plan_id=plan_id,
            plan_name=plan_name,
            idempotency_key=idempotency_key,
            status=status,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return {
            "id": payment.id,
            "amount_tzs": payment.amount_tzs,
            "provider": payment.provider,
            "provider_reference": payment.provider_reference,
            "status": payment.status,
            "plan_id": payment.plan_id,
            "plan_name": payment.plan_name,
        }
    finally:
        _gen.close()


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


# ── Payment plans (fees students/teachers pay to the platform) ───────────────


def create_plan(data) -> dict:
    from backend.models.payment_plan import PaymentPlan

    _gen = get_db()
    db = next(_gen)
    try:
        plan = PaymentPlan(
            name=data.name,
            description=data.description,
            amount_tzs=data.amount_tzs,
            currency=data.currency,
            audience=data.audience,
            is_active=data.is_active,
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return _plan_to_dict(plan)
    finally:
        _gen.close()


def list_plans(role: str | None = None, include_inactive: bool = False) -> list[dict]:
    from backend.models.payment_plan import PaymentPlan

    _gen = get_db()
    db = next(_gen)
    try:
        q = db.query(PaymentPlan)
        if not include_inactive:
            q = q.filter(PaymentPlan.is_active.is_(True))
        plans = q.order_by(PaymentPlan.created_at.desc()).all()
        result = [_plan_to_dict(p) for p in plans]
        if role:
            result = [
                p
                for p in result
                if p["audience"] in ("both", role)
            ]
        return result
    finally:
        _gen.close()


def get_plan(plan_id: str):
    from backend.models.payment_plan import PaymentPlan

    _gen = get_db()
    db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        return _plan_to_dict(plan) if plan else None
    finally:
        _gen.close()


def update_plan(plan_id: str, data) -> dict | None:
    from backend.models.payment_plan import PaymentPlan

    _gen = get_db()
    db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        if not plan:
            return None
        for field in ("name", "description", "amount_tzs", "currency", "audience", "is_active"):
            value = getattr(data, field, None)
            if value is not None:
                setattr(plan, field, value)
        db.commit()
        db.refresh(plan)
        return _plan_to_dict(plan)
    finally:
        _gen.close()


def delete_plan(plan_id: str) -> bool:
    from backend.models.payment_plan import PaymentPlan

    _gen = get_db()
    db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        if not plan:
            return False
        db.delete(plan)
        db.commit()
        return True
    finally:
        _gen.close()


def pay_plan(plan_id: str, user_id: str, mobile_number: str, provider: str, idempotency_key: str | None = None) -> dict:
    """Initiate an AzamPay checkout for a specific plan, crediting the platform."""
    plan = get_plan(plan_id)
    if not plan:
        raise ValueError("Plan not found")
    if not plan["is_active"]:
        raise ValueError("Plan is not active")
    result = initiate_checkout(
        user_id=user_id,
        amount_tzs=plan["amount_tzs"],
        mobile_number=mobile_number,
        provider=provider,
        idempotency_key=idempotency_key,
        plan_id=plan["id"],
        plan_name=plan["name"],
    )
    return result


def _plan_to_dict(plan) -> dict:
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "amount_tzs": plan.amount_tzs,
        "currency": plan.currency,
        "audience": plan.audience,
        "is_active": plan.is_active,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }
