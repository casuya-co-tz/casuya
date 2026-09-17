"""AI bridge — content moderation and translation."""

from __future__ import annotations

import logging

from .client import AiServiceError, _call_ai_service

logger = logging.getLogger(__name__)


async def moderate_content(text: str) -> dict:
    """Check content for appropriateness and safety."""
    try:
        result = await _call_ai_service(
            "/api/content/moderate",
            {"content": text},
        )
        if result:
            result["source"] = "casuya-ai"
            return result
    except AiServiceError as exc:
        logger.warning("AI moderation failed: %s", exc)

    flagged_terms = ["inappropriate", "offensive"]
    lower_text = text.lower()
    flags = [term for term in flagged_terms if term in lower_text]
    return {
        "safe": len(flags) == 0,
        "flags": flags,
        "confidence": 0.5 if flags else 0.9,
        "source": "offline",
    }


async def translate_content(text: str, target_language: str) -> tuple[str, str]:
    """Translate educational content. Returns (translated_text, source)."""
    try:
        result = await _call_ai_service(
            "/api/content/translate",
            {"text": text, "target_language": target_language},
        )
        if result:
            translated = result.get("translated") or result.get("translatedText") or text
            return translated, "casuya-ai"
    except AiServiceError as exc:
        logger.warning("AI translation failed: %s", exc)

    return text, "offline"
