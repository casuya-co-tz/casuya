"""Startup behaviour tests (B-07)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_startup_raises_when_database_required_and_init_fails(monkeypatch):
    from backend.config.settings import get_settings
    from backend.startup import platform_startup

    get_settings.cache_clear()
    monkeypatch.setenv("REQUIRE_DATABASE_ON_STARTUP", "true")
    get_settings.cache_clear()

    monkeypatch.setattr("backend.config.database.acquire_startup_lock", lambda: True)
    def _fail_init_db():
        raise ConnectionError("db down")

    monkeypatch.setattr("backend.config.database.init_db", _fail_init_db)
    monkeypatch.setattr("backend.config.database.release_startup_lock", lambda: None)

    with pytest.raises(ConnectionError, match="db down"):
        async for _ in platform_startup():
            pass

    get_settings.cache_clear()
    monkeypatch.delenv("REQUIRE_DATABASE_ON_STARTUP", raising=False)


@pytest.mark.asyncio
async def test_startup_continues_when_database_optional_and_init_fails(monkeypatch):
    from backend.config.settings import get_settings
    from backend.startup import platform_startup

    get_settings.cache_clear()
    monkeypatch.delenv("REQUIRE_DATABASE_ON_STARTUP", raising=False)

    monkeypatch.setattr("backend.config.database.acquire_startup_lock", lambda: True)
    def _fail_init_db():
        raise ConnectionError("db down")

    monkeypatch.setattr("backend.config.database.init_db", _fail_init_db)
    monkeypatch.setattr("backend.config.database.release_startup_lock", lambda: None)
    monkeypatch.setattr("backend.services.payment_cache.start_cache_sync", lambda: None)
    monkeypatch.setattr("backend.services.payment_cache.stop_cache_sync", lambda: None)
    monkeypatch.setattr("backend.services.analytics_events.start_retention_loop", lambda: None)
    monkeypatch.setattr("backend.services.analytics_events.stop_retention_loop", lambda: None)

    gen = platform_startup()
    await anext(gen)
    await gen.aclose()
