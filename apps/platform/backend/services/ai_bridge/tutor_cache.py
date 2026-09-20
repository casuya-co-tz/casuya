"""24-hour cache for identical tutoring requests (question + lesson context)."""

from __future__ import annotations

import hashlib
import json
import logging

from backend.middleware.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

TUTOR_CACHE_TTL = 86400


def tutor_cache_key(
    *,
    question: str,
    lesson_context: str = "",
    lesson_id: str | None = None,
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> str:
    payload = {
        "question": (question or "").strip(),
        "lesson_context": (lesson_context or "").strip()[:4000],
        "lesson_id": lesson_id or "",
        "subject_slug": subject_slug or "",
        "form_level": form_level or 0,
    }
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()[:32]
    return f"tutor:answer:{digest}"


def get_cached_tutor(key: str) -> dict | None:
    cached = cache_get(key, ttl_seconds=TUTOR_CACHE_TTL)
    return cached if isinstance(cached, dict) else None


def set_cached_tutor(key: str, payload: dict) -> None:
    cache_set(key, payload, ttl=TUTOR_CACHE_TTL)
    logger.debug("Cached tutoring answer key=%s format=%s", key, payload.get("formatLevel"))
