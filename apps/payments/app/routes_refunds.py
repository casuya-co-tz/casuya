"""Casuya Payments microservice — refund routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import RefundRecord
from app.services import get_db, refund_dict

router = APIRouter()


@router.get("/refunds")
def list_refunds(user_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(RefundRecord)
    if user_id:
        q = q.filter(RefundRecord.user_id == user_id)
    rows = q.order_by(RefundRecord.created_at.desc()).all()
    return [refund_dict(r) for r in rows]
