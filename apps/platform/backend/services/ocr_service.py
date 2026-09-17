"""Handwriting OCR via Mathpix (B-04 production proxy)."""

from __future__ import annotations

import base64
import binascii

import httpx

_MAX_IMAGE_BYTES = 512 * 1024


def decode_image_payload(image_b64: str) -> bytes:
    """Validate and decode a base64 PNG/JPEG payload from the client."""
    cleaned = image_b64.strip()
    if cleaned.startswith("data:"):
        cleaned = cleaned.split(",", 1)[-1]
    try:
        raw = base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image payload") from exc
    if not raw:
        raise ValueError("Empty image payload")
    if len(raw) > _MAX_IMAGE_BYTES:
        raise ValueError(f"Image exceeds {_MAX_IMAGE_BYTES // 1024} KB limit")
    return raw


def recognize_mathpix(image_b64: str, app_id: str, app_key: str) -> dict:
    """Call Mathpix /v3/text and normalize the response for the platform API."""
    decode_image_payload(image_b64)
    cleaned = image_b64.strip()
    if cleaned.startswith("data:"):
        src = cleaned
    else:
        src = f"data:image/png;base64,{cleaned}"

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            "https://api.mathpix.com/v3/text",
            headers={
                "Content-Type": "application/json",
                "app_id": app_id,
                "app_key": app_key,
            },
            json={
                "src": src,
                "formats": ["latex", "latex_styled"],
                "data_options": {"include_asciimath": True, "include_latex": True},
            },
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"Mathpix error: {resp.status_code}")

    data = resp.json()
    symbols = []
    for item in data.get("symbols") or []:
        symbols.append(
            {
                "latex": item.get("latex") or "",
                "bbox": item.get("bbox") or {"x": 0, "y": 0, "w": 0, "h": 0},
            }
        )
    return {
        "latex": data.get("latex") or data.get("latex_styled") or "",
        "confidence": float(data.get("confidence") or 0),
        "symbols": symbols,
    }
