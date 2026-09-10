"""Casuya Payments microservice — payment routes, checkout and webhook."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.azampay import mobile_checkout
from app.config import get_settings
from app.models import PaymentRecord, RefundRecord
from app.services import audit, get_db, now, payment_dict, refund_dict

router = APIRouter()

settings = get_settings()


class CheckoutBody(BaseModel):
    amount: float
    mobile_number: str
    provider: str = "m-pesa"
    user_id: str | None = None
    idempotency_key: str | None = None


class CreatePaymentBody(BaseModel):
    user_id: str | None = None
    amount: float
    currency: str = "TZS"
    provider: str = "azampay"
    metadata: dict | None = None


class RefundBody(BaseModel):
    amount: float | None = None
    reason: str = ""


@router.get("/payments")
def list_payments(
    user_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(PaymentRecord)
    if user_id:
        q = q.filter(PaymentRecord.user_id == user_id)
    if status:
        q = q.filter(PaymentRecord.status == status)
    rows = q.order_by(PaymentRecord.created_at.desc()).limit(limit).offset(offset).all()
    return [payment_dict(r) for r in rows]


@router.get("/payments/{payment_id}")
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment_dict(row)


@router.post("/payments")
def create_payment(body: CreatePaymentBody, db: Session = Depends(get_db)):
    row = PaymentRecord(
        user_id=body.user_id,
        amount=body.amount,
        currency=body.currency,
        provider=body.provider,
        status="pending",
        sandbox=settings.azampay_sandbox,
        metadata_json=body.metadata or {},
    )
    db.add(row)
    audit(db, "payment.create", "payment", row.id, body.user_id, {"amount": body.amount})
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@router.post("/payments/{payment_id}/process")
def process_payment(payment_id: str, db: Session = Depends(get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    row.status = "success"
    row.processed_at = now()
    audit(db, "payment.process", "payment", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@router.post("/payments/{payment_id}/cancel")
def cancel_payment(payment_id: str, db: Session = Depends(get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    row.status = "cancelled"
    audit(db, "payment.cancel", "payment", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@router.post("/payments/{payment_id}/refund")
def refund_payment(payment_id: str, body: RefundBody, db: Session = Depends(get_db)):
    payment = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    amount = body.amount if body.amount is not None else payment.amount
    refund = RefundRecord(
        payment_id=payment.id,
        user_id=payment.user_id,
        amount=amount,
        reason=body.reason,
        status="processed",
        processed_at=now(),
    )
    payment.status = "refunded"
    db.add(refund)
    audit(db, "payment.refund", "payment", payment.id, payment.user_id, {"amount": amount, "reason": body.reason})
    db.commit()
    db.refresh(refund)
    return refund_dict(refund)


@router.post("/checkout")
def checkout(body: CheckoutBody, db: Session = Depends(get_db)):
    if body.idempotency_key:
        existing = (
            db.query(PaymentRecord)
            .filter(PaymentRecord.idempotency_key == body.idempotency_key)
            .first()
        )
        if existing:
            return payment_dict(existing, idempotent=True)

    row = PaymentRecord(
        user_id=body.user_id,
        amount=body.amount,
        provider="azampay",
        mobile_number=body.mobile_number,
        idempotency_key=body.idempotency_key,
        status="pending",
        sandbox=settings.azampay_sandbox,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        result = mobile_checkout(
            amount_tzs=row.amount,
            mobile_number=body.mobile_number,
            provider=body.provider,
            external_id=row.id,
            callback_url=settings.azampay_callback_url,
        )
        data = result.get("data") or {}
        reference = (
            data.get("reference")
            or data.get("transactionId")
            or data.get("transactionReference")
            or result.get("reference")
        )
        pending = bool(result.get("pending"))
        success = (
            result.get("success", True)
            in (True, "true", "Success", "success")
            or str(data.get("status", "")).lower() == "completed"
        )
        row.provider_reference = reference
        if pending:
            row.status = "pending"
        elif success:
            row.status = "success"
            row.processed_at = now()
        else:
            row.status = "pending"
        row.note = result.get("message") or None
        audit(db, "checkout.initiate", "payment", row.id, row.user_id, {"provider": body.provider, "status": row.status})
        db.commit()
        db.refresh(row)
    except Exception as exc:  # noqa: BLE001
        row.status = "pending"
        row.note = str(exc)
        db.commit()
        db.refresh(row)

    return payment_dict(row)


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

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
        payload.get("payment_id"),
    ]
    candidates = [c for c in candidates if c]
    match = None
    for cand in candidates:
        match = (
            db.query(PaymentRecord)
            .filter(
                or_(
                    PaymentRecord.provider_reference == cand,
                    PaymentRecord.id == cand,
                    PaymentRecord.idempotency_key == cand,
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
        match.processed_at = now()
    elif failed:
        match.status = "failed"
    if payload.get("reference") or data.get("reference"):
        match.provider_reference = payload.get("reference") or data.get("reference")
    audit(db, "webhook.received", "payment", match.id, match.user_id, {"status": match.status})
    db.commit()
    return {"received": True, "matched": True, "payment_id": match.id, "status": match.status}
