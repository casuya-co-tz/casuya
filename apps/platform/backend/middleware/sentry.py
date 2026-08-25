import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from backend.config.settings import get_settings


def init_sentry():
    settings = get_settings()
    dsn = getattr(settings, "sentry_dsn", None)
    if not dsn:
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.environment,
        traces_sample_rate=0.2 if settings.environment == "production" else 1.0,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
    )
