"""Pix2Text math OCR engine (lazy-loaded, CPU-only).

Mirrors `apps/audio-stt/app/services/transcribe.py`: lazily loads the engine so
`/health` and `/readyz` stay up during rolling Railway deploys. Pix2Text is a
MIT-licensed math/formula OCR toolkit (CNN + CRNN recognition + MFD classifier)
that emits LaTeX directly. The heavy ML dependencies (torch CPU) are installed
from the Dockerfile during build; the engine itself is imported on first use.
"""

from __future__ import annotations

import re
from io import BytesIO
from typing import Any

from PIL import Image, UnidentifiedImageError

_engine: Any = None

_LATEX_BLOCK_RE = re.compile(r"\$\$(.+?)\$\$", flags=re.DOTALL)


def _load_engine() -> Any:
    global _engine
    if _engine is None:
        from pix2text import Pix2Text

        _engine = Pix2Text()
    return _engine


def _position_to_bbox(position) -> dict:
    """Convert a Pix2Text quad (list of [x, y] points) to a {x, y, w, h} box."""
    if not position:
        return {"x": 0, "y": 0, "w": 0, "h": 0}
    xs = [float(p[0]) for p in position]
    ys = [float(p[1]) for p in position]
    x0, y0 = min(xs), min(ys)
    x1, y1 = max(xs), max(ys)
    return {"x": round(x0, 2), "y": round(y0, 2), "w": round(x1 - x0, 2), "h": round(y1 - y0, 2)}


def _latex_from_items(items) -> tuple[str, list[dict]]:
    """Normalize Pix2Text output into (latex, symbols).

    Pix2Text 1.1+ returns a single document string with display equations
    wrapped in `$$...$$`; older versions return a list of per-region dicts.
    Both shapes are handled here so the service keeps working across versions.
    """
    if isinstance(items, str):
        blocks = _LATEX_BLOCK_RE.findall(items)
        if not blocks:
            return "", []
        latex = " ".join(re.sub(r"\s+", " ", b).strip() for b in blocks)
        return latex, []
    return "", []


def recognize_math(image_bytes: bytes) -> dict:
    """Recognize math in `image_bytes` and return LaTeX + symbol bounding boxes."""
    try:
        img = Image.open(BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError("Image payload is not a decodable PNG/JPEG") from exc
    engine = _load_engine()
    items = engine.recognize(img)

    latex, symbols = _latex_from_items(items)
    latex_parts: list[str] = [latex] if latex else []
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("type", "")
            if item_type in ("equation", "isolated"):
                text = item.get("text", "")
                if not text:
                    continue
                latex_parts.append(text)
                symbols.append(
                    {
                        "latex": text,
                        "bbox": _position_to_bbox(item.get("position")),
                    }
                )

    full_latex = " ".join(p for p in latex_parts if p)
    scores = [float(item.get("score", 0) or 0) for item in (items or []) if isinstance(item, dict)]
    confidence = sum(scores) / max(len(scores), 1)
    return {
        "latex": full_latex,
        "confidence": round(float(confidence), 4),
        "symbols": symbols,
    }


def model_ready() -> bool:
    try:
        _load_engine()
        return True
    except Exception:
        return False
