"""Payment API routes — subscriptions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.payments.common import _service_unavailable
from backend.middleware.auth import get_current_user
from backend.services.payment_service import cancel_subscription, create_subscription, list_user_subscriptions

router = APIRouter(tags=["payments"])


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
        role = current_user.get("role", "student")
        user_id = None if role == "admin" else current_user["sub"]
        return cancel_subscription(subscription_id, immediate, user_id=user_id)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))