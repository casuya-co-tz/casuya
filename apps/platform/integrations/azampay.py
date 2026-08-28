import re

from httpx import Client

from backend.config.settings import get_settings


# AzamPay uses a separate authenticator host for token issuance and a
# checkout host for payment APIs.
_AUTH_SANDBOX = "https://authenticator-sandbox.azampay.co.tz"
_AUTH_PROD = "https://authenticator.azampay.co.tz"
_CHECKOUT_SANDBOX = "https://sandbox.azampay.co.tz"
_CHECKOUT_PROD = "https://api.azampay.co.tz"


def _get_token(client: Client, client_id: str, client_secret: str) -> str:
    """Exchange client credentials for an OAuth token."""
    resp = client.post(
        "/AppRegistration/GenerateToken",
        json={"appName": "Casuya", "clientId": client_id, "clientSecret": client_secret},
    )
    if resp.status_code == 401:
        env = "SANDBOX" if str(client.base_url).endswith("authenticator-sandbox.azampay.co.tz") else "PRODUCTION"
        raise RuntimeError(
            f"AzamPay {env} authentication failed (401). The provided "
            "AZAMPAY_CLIENT_ID / AZAMPAY_CLIENT_SECRET were rejected. "
            "Verify them in the AzamPay developer portal and ensure the app is active."
        )
    resp.raise_for_status()
    data = resp.json()
    token = (
        (data.get("data") or {}).get("accessToken")
        or data.get("accessToken")
        or data.get("token")
        or data.get("Token")
    )
    if not token:
        raise RuntimeError(f"AzamPay token response missing token: {data}")
    return token


def _normalize_msisdn(mobile_number: str) -> str:
    """Return digits only, prefixed with country code 255."""
    digits = re.sub(r"\D", "", mobile_number)
    if digits.startswith("0"):
        digits = "255" + digits[1:]
    elif len(digits) == 9:
        digits = "255" + digits
    return digits


def _derive_network_provider(mobile_number: str) -> str:
    """Map a Tanzanian MSISDN to its AzamPay mobile-money network."""
    digits = _normalize_msisdn(mobile_number)
    # Strip country code for prefix checks
    national = digits[3:] if digits.startswith("255") else digits
    prefix = national[:2]
    mapping = {
        "71": "Airtel",
        "65": "Airtel",
        "74": "M-Pesa",
        "75": "M-Pesa",
        "67": "Tigo Pesa",
        "68": "Tigo Pesa",
        "76": "Halotel",
        "73": "Azam Pesa",
        "69": "Ezy Pesa",
    }
    return mapping.get(prefix, "Airtel")


def mobile_checkout(amount_tzs: float, mobile_number: str, provider: str, external_id: str) -> dict:
    settings = get_settings()

    # Dev-only mock mode: simulate a successful AzamPay response without
    # contacting AzamPay (used when sandbox credentials aren't activated yet).
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

    # `provider` from the API request identifies the gateway ("azampay").
    # AzamPay's checkout expects the mobile-money network instead.
    network = provider if provider.lower() != "azampay" else _derive_network_provider(mobile_number)
    msisdn = _normalize_msisdn(mobile_number)

    auth_client = Client(base_url=auth_base)
    token = _get_token(auth_client, settings.azampay_client_id, settings.azampay_client_secret)
    auth_client.close()

    headers = {"Authorization": f"Bearer {token}"}
    if settings.azampay_x_api_key:
        headers["X-API-Key"] = settings.azampay_x_api_key

    client = Client(base_url=checkout_base)
    resp = client.post(
        "/api/v1/Mobile/Checkout",
        json={
            "amount": amount_tzs,
            "mobileNumber": msisdn,
            "provider": network,
            "externalId": external_id,
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
