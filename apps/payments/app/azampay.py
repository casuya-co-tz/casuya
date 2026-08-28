"""AzamPay mobile-money checkout — self-contained copy for the payments service."""

import re

from httpx import Client

from app.config import get_settings


_AUTH_SANDBOX = "https://authenticator-sandbox.azampay.co.tz"
_AUTH_PROD = "https://authenticator.azampay.co.tz"
_CHECKOUT_SANDBOX = "https://sandbox.azampay.co.tz"
_CHECKOUT_PROD = "https://checkout.azampay.co.tz"


def _get_token(client: Client, app_name: str, client_id: str, client_secret: str) -> str:
    resp = client.post(
        "/AppRegistration/GenerateToken",
        json={
            "appName": app_name,
            "clientId": client_id,
            "clientSecret": client_secret,
        },
    )
    if resp.status_code == 401:
        env = "SANDBOX" if "authenticator-sandbox.azampay.co.tz" in str(client.base_url) else "PRODUCTION"
        raise RuntimeError(
            f"AzamPay {env} authentication failed (401). The provided "
            "AZAMPAY_CLIENT_ID / AZAMPAY_CLIENT_SECRET were rejected. "
            "Verify them in the AzamPay developer portal and ensure the app is active."
        )
    resp.raise_for_status()
    data = resp.json()
    token = (data.get("data") or {}).get("accessToken") or data.get("accessToken")
    if not token:
        raise RuntimeError(f"AzamPay token response missing accessToken: {data}")
    return token


def _normalize_msisdn(mobile_number: str) -> str:
    digits = re.sub(r"\D", "", mobile_number)
    if digits.startswith("0"):
        digits = "255" + digits[1:]
    elif len(digits) == 9:
        digits = "255" + digits
    return digits


def _normalize_provider(provider: str) -> str:
    p = re.sub(r"[\s_-]+", "", provider or "").lower()
    if "mpesa" in p or p in ("m", "vodacom"):
        return "Mpesa"
    if "tigo" in p:
        return "Tigo"
    if "airtel" in p:
        return "Airtel"
    if "halo" in p or "halotel" in p:
        return "Halopesa"
    if "azam" in p:
        return "Azampesa"
    if "ezy" in p or "eyezz" in p:
        return "Ezy Pesa"
    return "Mpesa"


def _derive_network_provider(mobile_number: str) -> str:
    digits = _normalize_msisdn(mobile_number)
    national = digits[3:] if digits.startswith("255") else digits
    prefix = national[:2]
    mapping = {
        "71": "Airtel",
        "65": "Airtel",
        "74": "Mpesa",
        "75": "Mpesa",
        "67": "Tigo",
        "68": "Tigo",
        "76": "Halopesa",
        "73": "Azampesa",
        "69": "Ezy Pesa",
    }
    return mapping.get(prefix, "Airtel")


def mobile_checkout(amount_tzs: float, mobile_number: str, provider: str, external_id: str, callback_url: str | None = None) -> dict:
    settings = get_settings()

    if getattr(settings, "azampay_mock", False):
        import uuid

        mock_ref = f"MOCK-{uuid.uuid4().hex[:12].upper()}"
        return {
            "success": True,
            "message": "Mock payment successful",
            "data": {
                "transactionId": mock_ref,
                "reference": mock_ref,
                "status": "Completed",
                "amount": amount_tzs,
                "mobileNumber": mobile_number,
                "provider": provider,
            },
        }

    if not settings.azampay_client_id or not settings.azampay_client_secret:
        raise RuntimeError("AzamPay credentials not configured")
    sandbox = getattr(settings, "azampay_sandbox", True)
    auth_base = _AUTH_SANDBOX if sandbox else _AUTH_PROD
    checkout_base = _CHECKOUT_SANDBOX if sandbox else _CHECKOUT_PROD

    if str(provider).lower() == "azampay":
        network = _derive_network_provider(mobile_number)
    else:
        network = _normalize_provider(provider)
    msisdn = _normalize_msisdn(mobile_number)

    auth_client = Client(base_url=auth_base)
    token = _get_token(
        auth_client,
        app_name=settings.azampay_app_name or "casuya",
        client_id=settings.azampay_client_id,
        client_secret=settings.azampay_client_secret,
    )
    auth_client.close()

    headers = {"Authorization": f"Bearer {token}"}
    if settings.azampay_x_api_key:
        headers["X-API-Key"] = settings.azampay_x_api_key

    client = Client(base_url=checkout_base)
    resp = client.post(
        "/azampay/mno/checkout",
        json={
            "accountNumber": msisdn,
            "amount": amount_tzs,
            "currency": "TZS",
            "externalId": external_id,
            "provider": network,
            "callbackUrl": callback_url,
            "additionalProperties": {"appName": settings.azampay_app_name or "casuya"},
        },
        headers=headers,
    )
    resp.raise_for_status()
    # AzamPay's sandbox accepts the request and returns an empty 200, then
    # reports the outcome asynchronously via the callback/webhook. Treat an
    # empty body as an accepted-but-pending payment awaiting that callback.
    if not resp.text.strip():
        return {
            "success": False,
            "pending": True,
            "message": "AzamPay accepted the request; status will be delivered via callback.",
            "data": {},
        }
    return resp.json()