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
        print(f"WARNING: init_db failed, continuing without DB: {exc}")
    finally:
        if acquired:
            await asyncio.to_thread(release_startup_lock)

    from backend.services.payment_cache import start_cache_sync, stop_cache_sync

    start_cache_sync()
    try:
        yield
    finally:
        stop_cache_sync()


def check_casuya_ai() -> dict:
    """Probe the casuya-ai service /health endpoint to report AI connectivity.

    Never raises and never blocks startup: any failure reports the AI service as
    unreachable so the platform's offline fallbacks (lesson/scheme generation,
    quiz/tutoring) are still expected to run.
    """
    import httpx

    from backend.services.ai_service import CASUYA_AI_URL

    if not CASUYA_AI_URL:
        return {"configured": False, "reachable": False, "url": ""}
    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{CASUYA_AI_URL}/health")
            payload = resp.json()
        return {
            "configured": True,
            "url": CASUYA_AI_URL,
            "reachable": resp.status_code < 400,
            "service": payload.get("service"),
            "version": payload.get("version"),
            "provider": payload.get("provider"),
        }
    except Exception as exc:
        return {
            "configured": True,
            "url": CASUYA_AI_URL,
            "reachable": False,
            "error": str(exc)[:120],
        }


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