"""Casuya Payments microservice — FastAPI entrypoint.

Source of truth for payments, subscriptions, invoices, refunds, and audit.
The platform (apps/platform) talks to this service over HTTP via
`backend/services/payments_client.py`.
"""

from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.azampay import mobile_checkout
from app.config import get_settings
from app.models import (
    AuditRecord,
    Base,
    InvoiceRecord,
    PaymentRecord,
    RefundRecord,
    SubscriptionRecord,
)

settings = get_settings()


def _engine():
    from sqlalchemy import create_engine

    kwargs = {}
    if settings.database_url.startswith("postgres"):
        kwargs["pool_pre_ping"] = True
    return create_engine(settings.database_url, **kwargs)


engine = _engine()


def _session() -> Session:
    return Session(engine)


def _get_db():
    db = _session()
    try:
        yield db
    finally:
        db.close()


def _now():
    return datetime.utcnow()


# ── Pydantic bodies ────────────────────────────────────────────────────────


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


class CancelBody(BaseModel):
    immediate: bool = False


class CreateSubscriptionBody(BaseModel):
    user_id: str
    plan_id: str | None = None
    amount: float = 0
    currency: str = "TZS"


class CreateInvoiceBody(BaseModel):
    user_id: str
    amount: float
    currency: str = "TZS"
    tax_amount: float = 0
    discount_amount: float = 0
    items: list | None = None
    due_date: str | None = None


# ── Serializers ─────────────────────────────────────────────────────────────


def payment_dict(p: PaymentRecord, idempotent: bool = False) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "amount": p.amount,
        "amount_tzs": p.amount,
        "currency": p.currency,
        "provider": p.provider,
        "provider_reference": p.provider_reference,
        "mobile_number": p.mobile_number,
        "plan_id": p.plan_id,
        "plan_name": p.plan_name,
        "invoice_id": p.invoice_id,
        "idempotency_key": p.idempotency_key,
        "status": p.status,
        "note": p.note,
        "sandbox": bool(p.sandbox),
        "idempotent": idempotent,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def sub_dict(s: SubscriptionRecord) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "plan_id": s.plan_id,
        "amount": s.amount,
        "currency": s.currency,
        "status": s.status,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "next_billing_at": s.next_billing_at.isoformat() if s.next_billing_at else None,
        "cancelled_at": s.cancelled_at.isoformat() if s.cancelled_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def invoice_dict(i: InvoiceRecord) -> dict:
    return {
        "id": i.id,
        "user_id": i.user_id,
        "amount": i.amount,
        "tax_amount": i.tax_amount,
        "discount_amount": i.discount_amount,
        "total": i.amount + (i.tax_amount or 0) - (i.discount_amount or 0),
        "currency": i.currency,
        "items": i.items or [],
        "status": i.status,
        "due_date": i.due_date,
        "paid_at": i.paid_at.isoformat() if i.paid_at else None,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def refund_dict(r: RefundRecord) -> dict:
    return {
        "id": r.id,
        "payment_id": r.payment_id,
        "user_id": r.user_id,
        "amount": r.amount,
        "reason": r.reason,
        "status": r.status,
        "processed_at": r.processed_at.isoformat() if r.processed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def audit_dict(a: AuditRecord) -> dict:
    return {
        "id": a.id,
        "actor_user_id": a.actor_user_id,
        "action": a.action,
        "entity": a.entity,
        "entity_id": a.entity_id,
        "details": a.details or {},
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _audit(db: Session, action: str, entity: str, entity_id: str | None, actor: str | None = None, details: dict | None = None) -> None:
    db.add(
        AuditRecord(
            actor_user_id=actor,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details,
        )
    )


# ── App ─────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(Base.metadata.create_all, engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "casuya-payments", "environment": settings.environment}


# ── Payments ────────────────────────────────────────────────────────────────


@app.get("/payments")
def list_payments(
    user_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(_get_db),
):
    q = db.query(PaymentRecord)
    if user_id:
        q = q.filter(PaymentRecord.user_id == user_id)
    if status:
        q = q.filter(PaymentRecord.status == status)
    rows = q.order_by(PaymentRecord.created_at.desc()).limit(limit).offset(offset).all()
    return [payment_dict(r) for r in rows]


@app.get("/payments/{payment_id}")
def get_payment(payment_id: str, db: Session = Depends(_get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment_dict(row)


@app.post("/payments")
def create_payment(body: CreatePaymentBody, db: Session = Depends(_get_db)):
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
    _audit(db, "payment.create", "payment", row.id, body.user_id, {"amount": body.amount})
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@app.post("/payments/{payment_id}/process")
def process_payment(payment_id: str, db: Session = Depends(_get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    row.status = "success"
    row.processed_at = _now()
    _audit(db, "payment.process", "payment", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@app.post("/payments/{payment_id}/cancel")
def cancel_payment(payment_id: str, db: Session = Depends(_get_db)):
    row = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    row.status = "cancelled"
    _audit(db, "payment.cancel", "payment", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return payment_dict(row)


@app.post("/payments/{payment_id}/refund")
def refund_payment(payment_id: str, body: RefundBody, db: Session = Depends(_get_db)):
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
        processed_at=_now(),
    )
    payment.status = "refunded"
    db.add(refund)
    _audit(db, "payment.refund", "payment", payment.id, payment.user_id, {"amount": amount, "reason": body.reason})
    db.commit()
    db.refresh(refund)
    return refund_dict(refund)


# ── Checkout (AzamPay) ──────────────────────────────────────────────────────


@app.post("/checkout")
def checkout(body: CheckoutBody, db: Session = Depends(_get_db)):
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
            # AzamPay accepted the request but will confirm via callback.
            row.status = "pending"
        elif success:
            row.status = "success"
            row.processed_at = _now()
        else:
            row.status = "pending"
        row.note = result.get("message") or None
        _audit(db, "checkout.initiate", "payment", row.id, row.user_id, {"provider": body.provider, "status": row.status})
        db.commit()
        db.refresh(row)
    except Exception as exc:  # noqa: BLE001
        row.status = "pending"
        row.note = str(exc)
        db.commit()
        db.refresh(row)

    return payment_dict(row)


@app.post("/webhook")
async def webhook(request: Request, db: Session = Depends(_get_db)):
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
        match.processed_at = _now()
    elif failed:
        match.status = "failed"
    if payload.get("reference") or data.get("reference"):
        match.provider_reference = payload.get("reference") or data.get("reference")
    _audit(db, "webhook.received", "payment", match.id, match.user_id, {"status": match.status})
    db.commit()
    return {"received": True, "matched": True, "payment_id": match.id, "status": match.status}


# ── Subscriptions ───────────────────────────────────────────────────────────


@app.get("/subscriptions")
def list_subscriptions(user_id: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(SubscriptionRecord)
    if user_id:
        q = q.filter(SubscriptionRecord.user_id == user_id)
    rows = q.order_by(SubscriptionRecord.created_at.desc()).all()
    return [sub_dict(r) for r in rows]


@app.get("/subscriptions/{subscription_id}")
def get_subscription(subscription_id: str, db: Session = Depends(_get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub_dict(row)


@app.post("/subscriptions")
def create_subscription(body: CreateSubscriptionBody, db: Session = Depends(_get_db)):
    now = datetime.utcnow()
    row = SubscriptionRecord(
        user_id=body.user_id,
        plan_id=body.plan_id,
        amount=body.amount,
        currency=body.currency,
        status="active",
        started_at=now,
        next_billing_at=now + timedelta(days=30),
    )
    db.add(row)
    _audit(db, "subscription.create", "subscription", row.id, body.user_id, {"plan_id": body.plan_id})
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@app.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription(subscription_id: str, body: CancelBody, db: Session = Depends(_get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "cancelled"
    row.cancelled_at = _now()
    _audit(db, "subscription.cancel", "subscription", row.id, row.user_id, {"immediate": body.immediate})
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@app.post("/subscriptions/{subscription_id}/pause")
def pause_subscription(subscription_id: str, db: Session = Depends(_get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "paused"
    _audit(db, "subscription.pause", "subscription", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@app.post("/subscriptions/{subscription_id}/resume")
def resume_subscription(subscription_id: str, db: Session = Depends(_get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "active"
    _audit(db, "subscription.resume", "subscription", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return sub_dict(row)


# ── Invoices ────────────────────────────────────────────────────────────────


@app.get("/invoices")
def list_invoices(user_id: str | None = None, status: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(InvoiceRecord)
    if user_id:
        q = q.filter(InvoiceRecord.user_id == user_id)
    if status:
        q = q.filter(InvoiceRecord.status == status)
    rows = q.order_by(InvoiceRecord.created_at.desc()).all()
    return [invoice_dict(r) for r in rows]


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(_get_db)):
    row = db.query(InvoiceRecord).filter(InvoiceRecord.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_dict(row)


@app.post("/invoices")
def create_invoice(body: CreateInvoiceBody, db: Session = Depends(_get_db)):
    row = InvoiceRecord(
        user_id=body.user_id,
        amount=body.amount,
        currency=body.currency,
        tax_amount=body.tax_amount,
        discount_amount=body.discount_amount,
        items=body.items or [],
        status="pending",
        due_date=body.due_date,
    )
    db.add(row)
    _audit(db, "invoice.create", "invoice", row.id, body.user_id, {"amount": body.amount})
    db.commit()
    db.refresh(row)
    return invoice_dict(row)


@app.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str, db: Session = Depends(_get_db)):
    row = db.query(InvoiceRecord).filter(InvoiceRecord.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    total = row.amount + (row.tax_amount or 0) - (row.discount_amount or 0)
    payment = PaymentRecord(
        user_id=row.user_id,
        amount=total,
        currency=row.currency,
        provider="azampay",
        invoice_id=row.id,
        status="success",
        sandbox=settings.azampay_sandbox,
        note="Invoice paid",
    )
    row.status = "paid"
    row.paid_at = _now()
    db.add(payment)
    _audit(db, "invoice.pay", "invoice", row.id, row.user_id, {"amount": total})
    db.commit()
    db.refresh(row)
    return {"invoice": invoice_dict(row), "payment": payment_dict(payment)}


# ── Refunds ─────────────────────────────────────────────────────────────────


@app.get("/refunds")
def list_refunds(user_id: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(RefundRecord)
    if user_id:
        q = q.filter(RefundRecord.user_id == user_id)
    rows = q.order_by(RefundRecord.created_at.desc()).all()
    return [refund_dict(r) for r in rows]


# ── Billing / Audit / Stats ─────────────────────────────────────────────────


@app.get("/billing")
def list_billing(user_id: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(InvoiceRecord)
    if user_id:
        q = q.filter(
            InvoiceRecord.user_id == user_id,
            InvoiceRecord.status == "pending",
        )
    else:
        q = q.filter(InvoiceRecord.status == "pending")
    invoices = [{"type": "invoice", "data": invoice_dict(r)} for r in q.limit(100).all()]
    return invoices


@app.get("/audit")
def list_audit(user_id: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(AuditRecord)
    if user_id:
        q = q.filter(AuditRecord.actor_user_id == user_id)
    rows = q.order_by(AuditRecord.created_at.desc()).limit(500).all()
    return [audit_dict(r) for r in rows]


@app.get("/stats")
def get_stats(user_id: str | None = None, db: Session = Depends(_get_db)):
    q = db.query(PaymentRecord)
    if user_id:
        q = q.filter(PaymentRecord.user_id == user_id)
    payments = q.all()
    subs = db.query(SubscriptionRecord)
    if user_id:
        subs = subs.filter(SubscriptionRecord.user_id == user_id)
    invs = db.query(InvoiceRecord)
    if user_id:
        invs = invs.filter(InvoiceRecord.user_id == user_id)
    refs = db.query(RefundRecord)
    if user_id:
        refs = refs.filter(RefundRecord.user_id == user_id)
    return {
        "user_id": user_id,
        "total_payments": len(payments),
        "completed_payments": sum(1 for p in payments if p.status == "success"),
        "total_revenue": sum(p.amount for p in payments if p.status == "success"),
        "total_paid": sum(p.amount for p in payments if p.status == "success"),
        "pending_amount": sum(p.amount for p in payments if p.status == "pending"),
        "total_transactions": len(payments),
        "active_subscriptions": sum(1 for s in subs.all() if s.status == "active"),
        "pending_invoices": sum(1 for i in invs.all() if i.status == "pending"),
        "total_refunds": sum(r.amount for r in refs.all()),
    }


@app.get("/readyz")
def readyz():
    ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ok = True
    except Exception:
        pass
    return {"status": "ok" if ok else "degraded", "database": ok}