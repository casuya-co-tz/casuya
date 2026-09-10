"""Payment API routes — checkout and AzamPay webhook."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.api.payments.common import _service_unavailable
from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user
from backend.schemas.payments import CheckoutRequest, PaymentResponse
from backend.services.payment_service import handle_webhook_payload, initiate_checkout

router = APIRouter(tags=["payments"])


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
    """Handle an AzamPay payment callback.

    The raw body is verified against AzamPay's signature before any state
    change is applied, so an unauthenticated caller cannot forge payment
    success/failure. In dev mock mode (azampay_mock=True) verification is
    skipped because mock callbacks are not signed.
    """
    body_bytes = await request.body()
    settings = get_settings()

    if not getattr(settings, "azampay_mock", False):
        secret = settings.azampay_webhook_secret or settings.azampay_client_secret
        signature = (
            request.headers.get("X-Signature")
            or request.headers.get("X-AzamPay-Signature")
            or request.headers.get("X-Callback-Signature")
        )
        if not secret:
            raise HTTPException(status_code=503, detail="Webhook signature secret not configured")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing webhook signature")

        import hashlib
        import hmac as hmac_mod

        expected = hmac_mod.new(str(secret).encode(), body_bytes, hashlib.sha256).hexdigest()
        # Accept SHA-256; some AzamPay callbacks echo a SHA-512 digest too.
        expected_sha512 = hmac_mod.new(str(secret).encode(), body_bytes, hashlib.sha512).hexdigest()
        provided = signature.strip()
        if not (hmac_mod.compare_digest(provided, expected) or hmac_mod.compare_digest(provided, expected_sha512)):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        return handle_webhook_payload(payload)
    except HTTPException:
        raise
    except ConnectionError:
        _service_unavailable()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))