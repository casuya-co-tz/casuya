"""AI bridge — content moderation and translation."""

from __future__ import annotations

from .client import _call_ai_service


async def moderate_content(text: str) -> dict:
    """Check content for appropriateness and safety."""
    result = await _call_ai_service(
        "/api/content/moderate",
        {
            "content": text,
        },
    )
    if result:
        return result

    # Fallback: basic pattern matching
    flagged_terms = ["inappropriate", "offensive"]
    lower_text = text.lower()
    flags = [term for term in flagged_terms if term in lower_text]
    return {
        "safe": len(flags) == 0,
        "flags": flags,
        "confidence": 0.5 if flags else 0.9,
    }


async def translate_content(text: str, target_language: str) -> str:
    """Translate educational content to the target language."""
    result = await _call_ai_service(
        "/api/content/translate",
        {
            "text": text,
            "target_language": target_language,
        },
    )
    if result:
        return result.get("translated") or result.get("translatedText") or text

    return text  # Return original if service unavailable
