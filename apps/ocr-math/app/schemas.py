"""Request/response schemas for the Casuya Math OCR microservice."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OcrRequest(BaseModel):
    """Base64-encoded PNG/JPEG image to recognize (mirrors the platform
    `OcrHandwritingRequest` shape). Supports an optional `data:` URI prefix."""

    image: str = Field(..., min_length=32, max_length=2_000_000)


class SymbolBBox(BaseModel):
    x: float = 0
    y: float = 0
    w: float = 0
    h: float = 0


class Symbol(BaseModel):
    latex: str = ""
    bbox: SymbolBBox = SymbolBBox()


class OcrResponse(BaseModel):
    latex: str = ""
    confidence: float = 0
    symbols: list[Symbol] = []
