"""Casuya Payments microservice — shared db session, serializers, and audit.

Shared helpers used across the route modules: the SQLAlchemy engine/session
dependency, record serializers, a UTC timestamp helper, and the audit writer.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    AuditRecord,
    InvoiceRecord,
    PaymentRecord,
    RefundRecord,
    SubscriptionRecord,
)

settings = get_settings()


def _engine():
    kwargs = {}
    if settings.database_url.startswith("postgres"):
        kwargs["pool_pre_ping"] = True
    return create_engine(settings.database_url, **kwargs)


engine = _engine()


def _session() -> Session:
    return Session(engine)


def get_db():
    db = _session()
    try:
        yield db
    finally:
        db.close()


def now() -> datetime:
    return datetime.utcnow()


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


def audit(db: Session, action: str, entity: str, entity_id: str | None, actor: str | None = None, details: dict | None = None) -> None:
    db.add(
        AuditRecord(
            actor_user_id=actor,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details,
        )
    )
