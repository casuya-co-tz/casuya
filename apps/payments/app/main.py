"""Casuya Payments microservice — FastAPI entrypoint.

Deployment uses `app.main:app` (see Dockerfile / gunicorn). Keep this module
as the import path: it re-exports the assembled `app` from the package.

The app assembly (routers, lifespan, health/readyz) lives in app/__init__.py.
Business logic lives in app/routes_*.py and app/services.py.
"""

from app import app

__all__ = ["app"]
