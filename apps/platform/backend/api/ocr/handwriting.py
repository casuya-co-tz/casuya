"""Platform OCR proxy — keeps Mathpix credentials server-side (B-04)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user
from backend.services.ocr_service import recognize_mathpix

router = APIRouter(tags=["ocr"])


class OcrHandwritingRequest(BaseModel):
    image: str = Field(..., min_length=32, max_length=2_000_000)


def _ocr_configured() -> bool:
    settings = get_settings()
    return (
        settings.ocr_provider == "mathpix"
        and bool(settings.mathpix_app_id)
        and bool(settings.mathpix_app_key)
    )


@router.get("/status")
def ocr_status(_current_user=Depends(get_current_user)):
    settings = get_settings()
    available = _ocr_configured()
    return {
        "available": available,
        "provider": settings.ocr_provider if available else "none",
    }


@router.post("/handwriting")
def recognize_handwriting(
    payload: OcrHandwritingRequest,
    _current_user=Depends(get_current_user),
):
    """Recognize handwritten math from a base64 PNG captured from the blackboard."""
    if not _ocr_configured():
        raise HTTPException(status_code=503, detail="OCR not configured")

    settings = get_settings()
    try:
        result = recognize_mathpix(payload.image, settings.mathpix_app_id, settings.mathpix_app_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OCR provider error: {exc}") from exc

    if not result.get("latex"):
        raise HTTPException(status_code=422, detail="No recognizable content in image")
    return result
