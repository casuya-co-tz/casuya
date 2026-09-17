"""OCR routes for the Casuya Math OCR microservice.

`GET /health` is deliberately open (no API key) so Railway's healthcheck can
probe it; only `POST /v1/ocr/recognize` requires the internal `X-API-Key`.
Accepts a base64 PNG/JPEG (optionally `data:`-prefixed) and returns LaTeX with
per-symbol bounding boxes.
"""

from __future__ import annotations

import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException

from app.schemas import OcrRequest, OcrResponse
from app.security import require_api_key
from app.services.recognize import recognize_math

router = APIRouter()

MAX_IMAGE_BYTES = 512 * 1024


@router.get("/health")
def health():
    return {"status": "ok", "service": "casuya-ocr-math"}


@router.post("/v1/ocr/recognize", response_model=OcrResponse)
def ocr_recognize(payload: OcrRequest, _auth: None = Depends(require_api_key)):
    image = payload.image.strip()
    if image.startswith("data:"):
        image = image.split(",", 1)[-1]
    try:
        raw = base64.b64decode(image, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image payload")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413, detail=f"Image exceeds {MAX_IMAGE_BYTES // 1024} KB limit"
        )
    try:
        result = recognize_math(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    if not result.get("latex"):
        raise HTTPException(status_code=422, detail="No recognizable content in image")
    return result
