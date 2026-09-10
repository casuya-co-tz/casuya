"""Shared helpers for the Casuya Services Bridge API routes."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from backend.services.services_bridge_client import get_services_bridge_client

_bridge = get_services_bridge_client()


def _ok(result: Any):
    return result


def _guard(fn):
    try:
        return fn()
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))