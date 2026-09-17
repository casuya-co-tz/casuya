"""Casuya Payments microservice — billing, audit and stats routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AuditRecord, InvoiceRecord, PaymentRecord, RefundRecord, SubscriptionRecord
from app.security import require_api_key
from app.services import audit_dict, get_db, invoice_dict

router = APIRouter()


@router.get("/billing")
def list_billing(user_id: str | None = None, _auth: None = Depends(require_api_key), db: Session = Depends(get_db)):
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
def list_audit(user_id: str | None = None, _auth: None = Depends(require_api_key), db: Session = Depends(get_db)):
    q = db.query(AuditRecord)
    if user_id:
        q = q.filter(AuditRecord.actor_user_id == user_id)
    rows = q.order_by(AuditRecord.created_at.desc()).limit(500).all()
    return [audit_dict(r) for r in rows]


@router.get("/stats")
def get_stats(user_id: str | None = None, _auth: None = Depends(require_api_key), db: Session = Depends(get_db)):
    pay_q = db.query(PaymentRecord)
    sub_q = db.query(SubscriptionRecord)
    inv_q = db.query(InvoiceRecord)
    ref_q = db.query(RefundRecord)
    if user_id:
        pay_q = pay_q.filter(PaymentRecord.user_id == user_id)
        sub_q = sub_q.filter(SubscriptionRecord.user_id == user_id)
        inv_q = inv_q.filter(InvoiceRecord.user_id == user_id)
        ref_q = ref_q.filter(RefundRecord.user_id == user_id)

    total_payments = pay_q.count()
    completed_payments = pay_q.filter(PaymentRecord.status == "success").count()
    total_revenue = (
        pay_q.filter(PaymentRecord.status == "success")
        .with_entities(func.coalesce(func.sum(PaymentRecord.amount), 0))
        .scalar()
        or 0
    )
    pending_amount = (
        pay_q.filter(PaymentRecord.status == "pending")
        .with_entities(func.coalesce(func.sum(PaymentRecord.amount), 0))
        .scalar()
        or 0
    )
    active_subscriptions = sub_q.filter(SubscriptionRecord.status == "active").count()
    pending_invoices = inv_q.filter(InvoiceRecord.status == "pending").count()
    total_refunds = ref_q.with_entities(func.coalesce(func.sum(RefundRecord.amount), 0)).scalar() or 0

    return {
        "user_id": user_id,
        "total_payments": total_payments,
        "completed_payments": completed_payments,
        "total_revenue": total_revenue,
        "total_paid": total_revenue,
        "pending_amount": pending_amount,
        "total_transactions": total_payments,
        "active_subscriptions": active_subscriptions,
        "pending_invoices": pending_invoices,
        "total_refunds": total_refunds,
    }
