"""Payment webhooks — microservice-first with local fallback."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.payment import Payment
from backend.services import payment_cache
from backend.services.payments_client import get_payments_client


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