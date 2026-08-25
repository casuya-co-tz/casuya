from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.schemas.payments import CheckoutRequest, PaymentResponse
from backend.services.payment_service import (
    cancel_subscription,
    create_subscription,
    get_invoice,
    get_user_payment_stats,
    handle_webhook_payload,
    initiate_checkout,
    list_all_payments,
    list_user_invoices,
    list_user_payments,
    list_user_refunds,
    list_user_subscriptions,
    pay_invoice,
    process_refund,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def _service_unavailable():
    raise HTTPException(
        status_code=503,
        detail="Payment service is unavailable. Please try again later.",
    )


# ── Checkout / Webhook ───────────────────────────────────────────────────────


@router.post("/checkout", response_model=PaymentResponse)
@router.post("/checkout/", response_model=PaymentResponse)
def create_checkout(body: CheckoutRequest, current_user=Depends(get_current_user)):
    try:
        result = initiate_checkout(
            user_id=current_user["sub"],
            amount_tzs=body.amount_tzs,
            mobile_number=body.mobile_number,
            provider=body.provider,
            idempotency_key=body.idempotency_key,
        )
        return PaymentResponse(**result)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
@router.post("/webhook/")
async def azampay_webhook(request: Request):
    payload = await request.json()
    try:
        return handle_webhook_payload(payload)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Transactions ─────────────────────────────────────────────────────────────


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


# ── Subscriptions ────────────────────────────────────────────────────────────


class SubscriptionRequest(BaseModel):
    plan_id: str
    amount: float
    currency: str = "TZS"


@router.get("/subscriptions")
@router.get("/subscriptions/")
def list_subscriptions(current_user=Depends(get_current_user)):
    try:
        return list_user_subscriptions(current_user["sub"])
    except ConnectionError:
        _service_unavailable()


@router.post("/subscriptions")
@router.post("/subscriptions/")
def create_sub(body: SubscriptionRequest, current_user=Depends(get_current_user)):
    try:
        return create_subscription(current_user["sub"], body.plan_id, body.amount)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/subscriptions/{subscription_id}/cancel")
@router.post("/subscriptions/{subscription_id}/cancel/")
def cancel_sub(subscription_id: str, immediate: bool = False, current_user=Depends(get_current_user)):
    try:
        return cancel_subscription(subscription_id, immediate)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Invoices ─────────────────────────────────────────────────────────────────


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
        return get_invoice(invoice_id)
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
        return pay_invoice(invoice_id)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Refunds ──────────────────────────────────────────────────────────────────


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
