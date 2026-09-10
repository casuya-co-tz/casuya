"""Payment API endpoints — checkout, plans, subscriptions, invoices, refunds."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.payments.checkout import router as checkout_router
from backend.api.payments.invoices import router as invoices_router
from backend.api.payments.plans import router as plans_router
from backend.api.payments.refunds import router as refunds_router
from backend.api.payments.subscriptions import router as subscriptions_router
from backend.api.payments.transactions import router as transactions_router

router = APIRouter(prefix="/payments", tags=["payments"])

# Include order preserves the original route registration order.
router.include_router(checkout_router)
router.include_router(plans_router)
router.include_router(transactions_router)
router.include_router(subscriptions_router)
router.include_router(invoices_router)
router.include_router(refunds_router)

__all__ = ["router"]