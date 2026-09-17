"""Casuya OCR proxy barrel (platform backend)."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.ocr.handwriting import router as handwriting_router

router = APIRouter(prefix="/v1/ocr", tags=["ocr"])
router.include_router(handwriting_router)

__all__ = ["router"]
