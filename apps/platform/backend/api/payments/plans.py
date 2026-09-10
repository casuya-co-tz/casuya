"""Payment API routes — payment plans (fees paid to the platform)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.api.payments.common import _service_unavailable
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.schemas.payments import (
    PaymentPlanCreate,
    PaymentPlanResponse,
    PaymentPlanUpdate,
    PlanCheckoutRequest,
    PaymentResponse,
)
from backend.services.payment_service import (
    create_plan,
    delete_plan,
    list_plans,
    pay_plan,
    update_plan,
)

router = APIRouter(tags=["payments"])


@router.get("/plans", response_model=list[PaymentPlanResponse])
@router.get("/plans/", response_model=list[PaymentPlanResponse])
def get_plans(current_user=Depends(get_current_user)):
    """List plans available to the current user's role (active only)."""
    role = current_user.get("role", "")
    try:
        return list_plans(role=role, include_inactive=False)
    except ConnectionError:
        _service_unavailable()


@router.get("/plans/all", response_model=list[PaymentPlanResponse])
@router.get("/plans/all/", response_model=list[PaymentPlanResponse])
def get_all_plans(_admin=Depends(require_role("admin"))):
    """List every plan (including inactive) — admin only."""
    try:
        return list_plans(include_inactive=True)
    except ConnectionError:
        _service_unavailable()


@router.post("/plans", response_model=PaymentPlanResponse)
@router.post("/plans/", response_model=PaymentPlanResponse)
def create_payment_plan(
    body: PaymentPlanCreate,
    _admin=Depends(require_role("admin")),
):
    try:
        return create_plan(body)
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/plans/{plan_id}", response_model=PaymentPlanResponse)
@router.put("/plans/{plan_id}/", response_model=PaymentPlanResponse)
def update_payment_plan(
    plan_id: str,
    body: PaymentPlanUpdate,
    _admin=Depends(require_role("admin")),
):
    try:
        plan = update_plan(plan_id, body)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/plans/{plan_id}")
@router.delete("/plans/{plan_id}/")
def delete_payment_plan(
    plan_id: str,
    _admin=Depends(require_role("admin")),
):
    try:
        if not delete_plan(plan_id):
            raise HTTPException(status_code=404, detail="Plan not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()


@router.post("/plans/{plan_id}/checkout", response_model=PaymentResponse)
@router.post("/plans/{plan_id}/checkout/", response_model=PaymentResponse)
def checkout_plan(
    plan_id: str,
    body: PlanCheckoutRequest,
    current_user=Depends(get_current_user),
):
    """Pay a specific plan via AzamPay; funds go to the platform (admin)."""
    try:
        result = pay_plan(
            plan_id=plan_id,
            user_id=current_user["sub"],
            mobile_number=body.mobile_number,
            provider=body.provider,
            idempotency_key=body.idempotency_key,
        )
        return PaymentResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))