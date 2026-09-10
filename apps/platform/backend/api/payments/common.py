"""Payment API routes — shared helpers."""

from __future__ import annotations

from fastapi import HTTPException


def _service_unavailable():
    raise HTTPException(
        status_code=503,
        detail="Payment service is unavailable. Please try again later.",
    )