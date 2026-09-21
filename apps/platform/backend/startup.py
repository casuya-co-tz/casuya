"""Startup sequence and health/readiness helpers for the FastAPI entrypoint.

Extracted from ``backend.main`` so the entrypoint stays a thin wiring layer:
the DDL/migration/rehydrate boot sequence, the casuya-ai health probe and the
readiness (DB + Redis) probe live here.
"""

from __future__ import annotations


async def platform_startup():
    """Run the one-time worker startup sequence, then yield for serving.

    Only the leader worker (holding the DB-init lock) runs DDL/migration and
    the storage rehydration; every worker starts the payment cache sync.
    """
    import asyncio
    import os

    from backend.config.database import acquire_startup_lock, release_startup_lock
    from backend.services.email_service import smtp_configured

    print(f"SMTP {'configured' if smtp_configured() else 'NOT configured (email resets disabled)'}")

    acquired = await asyncio.to_thread(acquire_startup_lock)
    try:
        if acquired:
            from backend.config.database import init_db

            await asyncio.to_thread(init_db)

            # Isolated analytics cluster: schema/retention-procedure creation is
            # best-effort and never allowed to block or fail the main boot.
            try:
                from backend.config.database_analytics import init_analytics_db

                await asyncio.to_thread(init_analytics_db)
            except Exception as analytics_exc:  # noqa: BLE001
                print(f"WARNING: analytics schema init skipped: {analytics_exc}")

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
                    print(f"Cloudflare cache rules {rules_result.get('action')}: {rules_result.get('rules_count')} rules")
            except Exception as cf_exc:
                print(f"Cloudflare rules deployment skipped: {cf_exc}")
    except Exception as exc:  # noqa: BLE001
        from backend.config.settings import get_settings

        if get_settings().require_database_on_startup:
            raise
        print(f"WARNING: init_db failed, continuing without DB: {exc}")
    finally:
        if acquired:
            await asyncio.to_thread(release_startup_lock)

    from backend.services.analytics_events import start_retention_loop
    from backend.services.payment_cache import start_cache_sync, stop_cache_sync

    start_cache_sync()
    start_retention_loop()
    try:
        yield
    finally:
        from backend.services.analytics_events import stop_retention_loop

        stop_retention_loop()
        stop_cache_sync()


def check_casuya_ai() -> dict:
    """Probe casuya-ai /readyz (and /health) for connectivity.

    Never raises and never blocks startup: any failure reports the AI service as
    unreachable so the platform's offline fallbacks are still expected to run.
    """
    import httpx

    from backend.config.settings import get_settings
    from backend.services.ai_bridge.client import get_casuya_ai_url

    base_url = get_casuya_ai_url()
    if not base_url:
        return {"configured": False, "reachable": False, "url": ""}

    settings = get_settings()
    headers: dict[str, str] = {}
    if settings.casuya_ai_api_key:
        headers["X-API-Key"] = settings.casuya_ai_api_key

    result: dict = {"configured": True, "url": base_url, "reachable": False}
    try:
        with httpx.Client(timeout=4.0) as client:
            ready = client.get(f"{base_url}/readyz", headers=headers)
            if ready.status_code < 400:
                ready_payload = ready.json()
                result.update(
                    {
                        "reachable": ready_payload.get("status") == "ok",
                        "ready": ready_payload.get("status"),
                        "kb_ready": ready_payload.get("kb_ready"),
                        "providers_ready": ready_payload.get("providers_ready"),
                        "provider_chain": ready_payload.get("provider_chain"),
                        "embeddings_ready": ready_payload.get("embeddings_ready"),
                        "embeddings_count": ready_payload.get("embeddings_count"),
                    }
                )
            health = client.get(f"{base_url}/health", headers=headers)
            if health.status_code < 400:
                health_payload = health.json()
                result.update(
                    {
                        "service": health_payload.get("service"),
                        "version": health_payload.get("version"),
                        "provider": health_payload.get("provider"),
                    }
                )
                if not result.get("reachable"):
                    result["reachable"] = True
    except Exception as exc:
        result["error"] = str(exc)[:120]
    return result


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
