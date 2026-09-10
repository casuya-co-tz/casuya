"""Casuya Payments microservice — FastAPI app assembly.

Builds the FastAPI app, wires in all route routers, sets up the lifespan
(startup/shutdown) events, and defines app-level endpoints (health, readyz).
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.config import get_settings
from app.models import Base
from app.routes_invoices import router as invoices_router
from app.routes_misc import router as misc_router
from app.routes_payments import router as payments_router
from app.routes_refunds import router as refunds_router
from app.routes_subscriptions import router as subscriptions_router
from app.services import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(Base.metadata.create_all, engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

app.include_router(payments_router)
app.include_router(subscriptions_router)
app.include_router(invoices_router)
app.include_router(refunds_router)
app.include_router(misc_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "casuya-payments", "environment": settings.environment}


@app.get("/readyz")
def readyz():
    ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ok = True
    except Exception:
        pass
    return {"status": "ok" if ok else "degraded", "database": ok}
