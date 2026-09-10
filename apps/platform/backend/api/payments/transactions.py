"""Payment API routes — transactions and payment history."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.payments.common import _service_unavailable
from backend.middleware.auth import get_current_user
from backend.services.payment_service import list_all_payments, list_user_payments, get_user_payment_stats

router = APIRouter(tags=["payments"])


@router.get("/transactions")
@router.get("/transactions/")
def list_transactions(current_user=Depends(get_current_user)):
    try:
        role = current_user.get("role", "student")
        if role == "admin":
            return list_all_payments()
        return list_user_payments(current_user["sub"])
    except ConnectionError:
        _service_unavailable()


@router.get("/my-history")
@router.get("/my-history/")
def my_payment_history(current_user=Depends(get_current_user)):
    try:
        stats = get_user_payment_stats(current_user["sub"])
        transactions = list_user_payments(current_user["sub"])
        return {
            "transactions": transactions,
            "total_paid": stats.get("total_paid", 0),
            "pending_amount": stats.get("pending_amount", 0),
            "total_transactions": stats.get("total_transactions", 0),
        }
    except ConnectionError:
        _service_unavailable()