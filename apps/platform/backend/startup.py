"""Startup sequence and health/readiness helpers for the FastAPI entrypoint.

Extracted from ``backend.main`` so the entrypoint stays a thin wiring layer:
the DDL/migration/rehydrate boot sequence and the readiness (DB + Redis) probe
live here.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def run_alembic_upgrade() -> None:
    """Apply versioned migrations when explicitly enabled.

    The runtime ``init_db()`` reconciliation still runs afterwards (it adds
    columns/indexes defensively and is what SQLite tests use). Production can
    set ``RUN_ALEMBIC_ON_STARTUP=true`` so a migration revision is recorded;
    CI already runs ``alembic upgrade head`` as a separate step.
    """
    from backend.config.settings import get_settings

    settings = get_settings()
    if not settings.run_alembic_on_startup:
        return

    platform_root = Path(__file__).resolve().parents[1]
    if not (platform_root / "alembic.ini").exists():
        raise RuntimeError(f"alembic.ini not found under {platform_root}")

    logger.info("Applying Alembic migrations (upgrade head)")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(platform_root),
        check=True,
        timeout=300,
    )


async def platform_startup():
    """Run the one-time worker startup sequence, then yield for serving.

    Only the leader worker (holding the DB-init lock) runs migrations, DDL and
    the storage rehydration; every worker starts the payment cache sync.
    """
    from backend.config.database import acquire_startup_lock, release_startup_lock
    from backend.services.email_service import smtp_configured

    logger.info("SMTP %s", "configured" if smtp_configured() else "NOT configured (email resets disabled)")

    acquired = await asyncio.to_thread(acquire_startup_lock)
    try:
        if acquired:
            from backend.config.database import init_db

            await asyncio.to_thread(run_alembic_upgrade)
            await asyncio.to_thread(init_db)

            # Isolated analytics cluster: schema/retention-procedure creation is
            # best-effort and never allowed to block or fail the main boot.
            try:
                from backend.config.database_analytics import init_analytics_db

                await asyncio.to_thread(init_analytics_db)
            except Exception as analytics_exc:  # noqa: BLE001
                logger.warning("analytics schema init skipped: %s", analytics_exc)

            admin_email = os.environ.get("CASUYA_ADMIN_EMAIL", "").strip()
            admin_password = os.environ.get("CASUYA_ADMIN_PASSWORD", "").strip()
            if admin_email and admin_password:
                from database.seeds.create_admin import create_admin

                admin_name = os.environ.get("CASUYA_ADMIN_NAME", "Platform Admin")
                await asyncio.to_thread(create_admin, admin_email, admin_password, admin_name)

            from backend.services.storage_rehydrate import rehydrate_storage

            await asyncio.to_thread(rehydrate_storage)

            try:
                from integrations.cloudflare import deploy_cache_rules

                rules_result = await asyncio.to_thread(deploy_cache_rules)
                if rules_result.get("status") == "success":
                    logger.info("Cloudflare cache rules %s: %s rules", rules_result.get("action"), rules_result.get("rules_count"))
            except Exception as cf_exc:
                logger.warning("Cloudflare rules deployment skipped: %s", cf_exc)
    except Exception as exc:  # noqa: BLE001
        from backend.config.settings import get_settings

        settings = get_settings()
        if settings.require_database_on_startup or settings.run_alembic_on_startup:
            raise
        logger.warning("startup schema init failed, continuing without DB: %s", exc)
    finally:
        if acquired:
            await asyncio.to_thread(release_startup_lock)

    from backend.services.analytics_events import start_retention_loop
    from backend.services.job_scheduler import start_job_scheduler, stop_job_scheduler
    from backend.services.payment_cache import start_cache_sync, stop_cache_sync

    start_cache_sync()
    start_retention_loop()
    start_job_scheduler(leader=bool(acquired))
    try:
        yield
    finally:
        from backend.services.analytics_events import stop_retention_loop
        from backend.services.http_client import aclose_http_clients, close_http_clients

        await stop_job_scheduler()
        stop_retention_loop()
        stop_cache_sync()
        await aclose_http_clients()
        close_http_clients()


def readiness_status() -> dict:
    from sqlalchemy import text

    from backend.config.database import get_engine, redis_client

    db_ok = False
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    redis_ok = False
    try:
        redis_ok = redis_client.ping()
    except Exception:
        pass

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "database": db_ok,
        "redis": redis_ok,
    }
