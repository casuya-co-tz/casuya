from httpx import Client

from backend.config.settings import get_settings


def mobile_checkout(amount_tzs: float, mobile_number: str, provider: str, external_id: str) -> dict:
    settings = get_settings()
    if not settings.azampay_client_id or not settings.azampay_client_secret:
        raise RuntimeError("AzamPay credentials not configured")
    sandbox = getattr(settings, "azampay_sandbox", True)
    base_url = "https://sandbox.azampay.co.tz" if sandbox else "https://api.azampay.co.tz"
    client = Client(base_url=base_url)
    resp = client.post(
        "/api/v1/mobile-checkout",
        json={
            "amount": amount_tzs,
            "mobileNumber": mobile_number,
            "provider": provider,
            "externalId": external_id,
            "clientId": settings.azampay_client_id,
            "clientSecret": settings.azampay_client_secret,
        },
    )
    resp.raise_for_status()
    return resp.json()
