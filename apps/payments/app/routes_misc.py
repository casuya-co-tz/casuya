"""Casuya Payments microservice — billing, audit and stats routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import AuditRecord, InvoiceRecord, PaymentRecord, RefundRecord, SubscriptionRecord
from app.services import audit_dict, get_db, invoice_dict

router = APIRouter()


@router.get("/billing")
def list_billing(user_id: str | None = None, db: Session = Depends(get_db)):
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


@router.get("/audit")
def list_audit(user_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(AuditRecord)
    if user_id:
        q = q.filter(AuditRecord.actor_user_id == user_id)
    rows = q.order_by(AuditRecord.created_at.desc()).limit(500).all()
    return [audit_dict(r) for r in rows]


@router.get("/stats")
def get_stats(user_id: str | None = None, db: Session = Depends(get_db)):
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
