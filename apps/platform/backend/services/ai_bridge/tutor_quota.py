"""Daily tutoring quota for students (teachers/admins unlimited)."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException

from backend.middleware.cache import cache_get, cache_set

STUDENT_TUTOR_DAILY_LIMIT = 30


def enforce_student_tutor_quota(user: dict) -> None:
    role = (user or {}).get("role", "")
    if role != "student":
        return
    user_id = user.get("sub")
    if not user_id:
        return
    key = f"ai_tutor_daily:{user_id}:{date.today().isoformat()}"
    count = cache_get(key, ttl_seconds=86400) or 0
    try:
        count = int(count)
    except (TypeError, ValueError):
        count = 0
    if count >= STUDENT_TUTOR_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI tutor limit reached ({STUDENT_TUTOR_DAILY_LIMIT} questions). Try again tomorrow.",
        )
    cache_set(key, count + 1, ttl=86400)
