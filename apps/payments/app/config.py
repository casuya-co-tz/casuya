"""Casuya Payments microservice — configuration."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "casuya-payments"
    database_url: str = "sqlite:///./casuya_payments.db"
    environment: str = "production"

    # Internal API key required by every non-webhook endpoint. The platform
    # backend sends it as the X-API-Key header. When unset the endpoints stay
    # open in dev; production deployments MUST set it.
    api_key: str | None = None

    # AzamPay mobile-money integration (mock mode needs no credentials).
    azampay_client_id: str | None = None
    azampay_client_secret: str | None = None
    azampay_app_name: str | None = None
    azampay_x_api_key: str | None = None
    azampay_sandbox: bool = True
    azampay_mock: bool = False
    azampay_callback_url: str | None = None
    # Dedicated secret used to verify AzamPay webhook callbacks (HMAC-SHA256
    # over the raw body). Falls back to azampay_client_secret when unset.
    azampay_webhook_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()