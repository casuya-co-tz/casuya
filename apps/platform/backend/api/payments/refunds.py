"""Payment API routes — refunds."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.payments.common import _service_unavailable
from backend.middleware.auth import get_current_user
from backend.services.payment_service import list_user_refunds, process_refund

router = APIRouter(tags=["payments"])


class RefundRequest(BaseModel):
    payment_id: str
    amount: float | None = None
    reason: str = ""


@router.get("/refunds")
@router.get("/refunds/")
def list_refunds(current_user=Depends(get_current_user)):
    try:
        return list_user_refunds(current_user["sub"])
    except ConnectionError:
        _service_unavailable()


@router.post("/refunds")
@router.post("/refunds/")
def create_refund(body: RefundRequest, current_user=Depends(get_current_user)):
    role = current_user.get("role", "student")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can process refunds")
    try:
        return process_refund(body.payment_id, body.amount, body.reason)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))