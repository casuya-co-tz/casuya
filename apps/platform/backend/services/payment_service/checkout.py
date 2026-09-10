"""Payment checkout — microservice-first with direct AzamPay fallback.

The microservice (SQLite) is the single source of truth. When it is
unreachable (e.g. local dev without it running), checkout falls back to a
direct AzamPay integration so payments still work.
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