"""Casuya Audio-TTS package root.

The FastAPI application is assembled in `app.main`
(entrypoint: `gunicorn app.main:app`).
"""

from __future__ import annotations

from app.main import app, create_app

__all__ = ["app", "create_app"]
