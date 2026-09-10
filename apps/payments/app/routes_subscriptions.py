"""Casuya Payments microservice — subscription routes."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import SubscriptionRecord
from app.services import audit, get_db, now, sub_dict

router = APIRouter()


class CreateSubscriptionBody(BaseModel):
    user_id: str
    plan_id: str | None = None
    amount: float = 0
    currency: str = "TZS"


class CancelBody(BaseModel):
    immediate: bool = False


@router.get("/subscriptions")
def list_subscriptions(user_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(SubscriptionRecord)
    if user_id:
        q = q.filter(SubscriptionRecord.user_id == user_id)
    rows = q.order_by(SubscriptionRecord.created_at.desc()).all()
    return [sub_dict(r) for r in rows]


@router.get("/subscriptions/{subscription_id}")
def get_subscription(subscription_id: str, db: Session = Depends(get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub_dict(row)


@router.post("/subscriptions")
def create_subscription(body: CreateSubscriptionBody, db: Session = Depends(get_db)):
    _now = datetime.utcnow()
    row = SubscriptionRecord(
        user_id=body.user_id,
        plan_id=body.plan_id,
        amount=body.amount,
        currency=body.currency,
        status="active",
        started_at=_now,
        next_billing_at=_now + timedelta(days=30),
    )
    db.add(row)
    audit(db, "subscription.create", "subscription", row.id, body.user_id, {"plan_id": body.plan_id})
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@router.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription(subscription_id: str, body: CancelBody, db: Session = Depends(get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "cancelled"
    row.cancelled_at = now()
    audit(db, "subscription.cancel", "subscription", row.id, row.user_id, {"immediate": body.immediate})
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@router.post("/subscriptions/{subscription_id}/pause")
def pause_subscription(subscription_id: str, db: Session = Depends(get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "paused"
    audit(db, "subscription.pause", "subscription", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return sub_dict(row)


@router.post("/subscriptions/{subscription_id}/resume")
def resume_subscription(subscription_id: str, db: Session = Depends(get_db)):
    row = db.query(SubscriptionRecord).filter(SubscriptionRecord.id == subscription_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    row.status = "active"
    audit(db, "subscription.resume", "subscription", row.id, row.user_id)
    db.commit()
    db.refresh(row)
    return sub_dict(row)
