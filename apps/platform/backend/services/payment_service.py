"""Payment service — reads from in-memory cache (<1ms), writes to microservice.

The microservice (SQLite) is the single source of truth.
The in-memory cache serves all read operations instantly.
After writes, cache is immediately refreshed.

When the casuya-payments microservice is unreachable (e.g. local dev without
it running), checkout falls back to a direct AzamPay integration so payments
still work.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from backend.config.database import get_db

logger = logging.getLogger(__name__)
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
    db: Session | None = None,
) -> dict:
    """Process an AzamPay mobile checkout directly, storing a Payment record.

    The record is created first so its id can be sent as AzamPay's
    ``externalId`` — that lets the async callback/webhook match the record
    even when AzamPay returns an empty body at checkout time.
    """
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        payment = Payment(
            user_id=user_id,
            amount_tzs=amount_tzs,
            provider="azampay",
            plan_id=plan_id,
            plan_name=plan_name,
            idempotency_key=idempotency_key,
            status="pending",
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

        from integrations.azampay import mobile_checkout

        try:
            result = mobile_checkout(
                amount_tzs=amount_tzs,
                mobile_number=mobile_number,
                provider=provider,
                external_id=payment.id,
            )
        except Exception as exc:  # noqa: BLE001
            # Network/transport errors (e.g. sandbox connection resets) or a
            # rejected request: keep the record pending so it can be retried
            # or confirmed via the async callback rather than failing hard.
            logger.warning("AzamPay checkout failed for payment %s: %s", payment.id, exc)
            payment.provider_reference = None
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

        data = result.get("data", result)
        reference = (
            data.get("reference")
            or data.get("transactionId")
            or data.get("transactionReference")
            or result.get("reference")
        )
        pending = bool(result.get("pending"))
        success = (
            result.get("success", True) in (True, "true", "Success", "success")
            or str(data.get("status", "")).lower() == "completed"
        )
        payment.provider_reference = reference
        if pending or not success:
            # Await the async callback; do not mark as paid yet.
            payment.status = "pending"
        elif success:
            payment.status = "success"
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
        if own:
            _gen.close()


def handle_webhook_payload(payload: dict) -> dict:
    try:
        client = get_payments_client()
        result = client.webhook(payload)
        payment_cache.invalidate()
        return result
    except ConnectionError:
        # Microservice unreachable (the same condition that routed checkout to
        # the direct AzamPay integration) — apply the callback locally so the
        # platform's own Payment records stay in sync.
        result = _apply_local_webhook(payload)
        payment_cache.invalidate()
        return result


def _apply_local_webhook(payload: dict, db: Session | None = None) -> dict:
    """Update the platform's Payment records from an AzamPay callback.

    Used when the casuya-payments microservice is unavailable. The checkout
    flow passes the Payment id as AzamPay's ``externalId``, so callbacks can
    be matched back to the record.
    """
    from sqlalchemy import or_

    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    candidates = [
        payload.get("transactionId"),
        payload.get("transaction_id"),
        payload.get("reference"),
        payload.get("externalId"),
        payload.get("external_id"),
        data.get("transactionId"),
        data.get("reference"),
        data.get("externalId"),
        data.get("external_id"),
    ]
    candidates = [c for c in candidates if c]

    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        match = None
        for cand in candidates:
            match = (
                db.query(Payment)
                .filter(
                    or_(
                        Payment.provider_reference == cand,
                        Payment.id == cand,
                        Payment.idempotency_key == cand,
                    )
                )
                .first()
            )
            if match:
                break
        if not match:
            return {"received": True, "matched": False, "payment_id": None}

        verified = payload.get("status") or data.get("status")
        status_lower = str(verified).lower()
        completed = status_lower in ("completed", "success", "successful", "paid", "confirmed")
        failed = status_lower in ("failed", "cancelled", "canceled", "rejected", "declined")
        if completed:
            match.status = "success"
        elif failed:
            match.status = "failed"
        if payload.get("reference") or data.get("reference"):
            match.provider_reference = payload.get("reference") or data.get("reference")
        db.commit()
        return {"received": True, "matched": True, "payment_id": match.id, "status": match.status}
    finally:
        if own:
            _gen.close()


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


def cancel_subscription(subscription_id: str, immediate: bool = False, user_id: str | None = None) -> dict:
    client = get_payments_client()
    result = client.cancel_subscription(subscription_id=subscription_id, immediate=immediate, user_id=user_id)
    payment_cache.invalidate()
    return result


# ── Invoices ─────────────────────────────────────────────────────────────


def list_user_invoices(user_id: str) -> list[dict]:
    return payment_cache.get_invoices(user_id=user_id)


def get_invoice(invoice_id: str, user_id: str | None = None) -> dict:
    client = get_payments_client()
    return client.get_invoice(invoice_id=invoice_id, user_id=user_id)


def pay_invoice(invoice_id: str, user_id: str | None = None) -> dict:
    client = get_payments_client()
    result = client.pay_invoice(invoice_id=invoice_id, user_id=user_id)
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


def create_plan(data, db: Session | None = None) -> dict:
    from backend.models.payment_plan import PaymentPlan

    own = db is None
    if own:
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
        if own:
            _gen.close()


def list_plans(role: str | None = None, include_inactive: bool = False, db: Session | None = None) -> list[dict]:
    from backend.models.payment_plan import PaymentPlan

    own = db is None
    if own:
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
        if own:
            _gen.close()


def get_plan(plan_id: str, db: Session | None = None):
    from backend.models.payment_plan import PaymentPlan

    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        return _plan_to_dict(plan) if plan else None
    finally:
        if own:
            _gen.close()


def update_plan(plan_id: str, data, db: Session | None = None) -> dict | None:
    from backend.models.payment_plan import PaymentPlan

    own = db is None
    if own:
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
        if own:
            _gen.close()


def delete_plan(plan_id: str, db: Session | None = None) -> bool:
    from backend.models.payment_plan import PaymentPlan

    own = db is None
    if own:
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
        if own:
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
