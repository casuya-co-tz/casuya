"""Payment API routes — invoices."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.api.payments.common import _service_unavailable
from backend.middleware.auth import get_current_user
from backend.services.payment_service import get_invoice, list_user_invoices, pay_invoice

router = APIRouter(tags=["payments"])


@router.get("/invoices")
@router.get("/invoices/")
def list_invoices(status: str | None = None, current_user=Depends(get_current_user)):
    try:
        role = current_user.get("role", "student")
        if role == "admin":
            from backend.services.payment_cache import get_invoices

            return get_invoices()
        return list_user_invoices(current_user["sub"])
    except ConnectionError:
        _service_unavailable()


@router.get("/invoices/{invoice_id}")
@router.get("/invoices/{invoice_id}/")
def get_inv(invoice_id: str, current_user=Depends(get_current_user)):
    try:
        role = current_user.get("role", "student")
        user_id = None if role == "admin" else current_user["sub"]
        return get_invoice(invoice_id, user_id=user_id)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/invoices/{invoice_id}/pay")
@router.post("/invoices/{invoice_id}/pay/")
def pay_inv(invoice_id: str, current_user=Depends(get_current_user)):
    try:
        role = current_user.get("role", "student")
        user_id = None if role == "admin" else current_user["sub"]
        return pay_invoice(invoice_id, user_id=user_id)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))