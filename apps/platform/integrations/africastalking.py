from httpx import Client

from backend.config.settings import get_settings


def send_sms(to: str, message: str) -> dict:
    settings = get_settings()
    if not settings.africastalking_username or not settings.africastalking_api_key:
        raise RuntimeError("Africa's Talking credentials not configured")
    client = Client(
        base_url="https://api.africastalking.com",
        headers={
            "apiKey": settings.africastalking_api_key,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    resp = client.post(
        "/version1/messaging",
        data={
            "username": settings.africastalking_username,
            "to": to,
            "message": message,
        },
    )
    resp.raise_for_status()
    return resp.json()
