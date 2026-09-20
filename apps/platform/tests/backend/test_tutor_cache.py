"""Tests for tutoring answer cache and student daily quota."""

import pytest
from fastapi import HTTPException

from backend.services.ai_bridge.tutor_cache import (
    get_cached_tutor,
    set_cached_tutor,
    tutor_cache_key,
)
from backend.services.ai_bridge.tutor_quota import enforce_student_tutor_quota


def test_tutor_cache_key_is_stable():
    a = tutor_cache_key(question="What is x?", lesson_id="lesson-1", subject_slug="math", form_level=2)
    b = tutor_cache_key(question="What is x?", lesson_id="lesson-1", subject_slug="math", form_level=2)
    c = tutor_cache_key(question="Different?", lesson_id="lesson-1", subject_slug="math", form_level=2)
    assert a == b
    assert a != c


def test_tutor_cache_round_trip():
    key = tutor_cache_key(question="Explain photosynthesis", lesson_id="abc")
    payload = {"response": "Plants use sunlight.", "source": "casuya-ai", "formatLevel": "partial"}
    set_cached_tutor(key, payload)
    cached = get_cached_tutor(key)
    assert cached is not None
    assert cached["response"] == payload["response"]


def test_student_quota_blocks_after_limit(monkeypatch):
    counts = {"n": 0}

    def fake_get(key, ttl_seconds=60):
        return counts["n"]

    def fake_set(key, value, ttl=300):
        counts["n"] = value

    monkeypatch.setattr("backend.services.ai_bridge.tutor_quota.cache_get", fake_get)
    monkeypatch.setattr("backend.services.ai_bridge.tutor_quota.cache_set", fake_set)
    monkeypatch.setattr("backend.services.ai_bridge.tutor_quota.STUDENT_TUTOR_DAILY_LIMIT", 2)

    enforce_student_tutor_quota({"role": "student", "sub": "stu-1"})
    enforce_student_tutor_quota({"role": "student", "sub": "stu-1"})
    with pytest.raises(HTTPException) as exc:
        enforce_student_tutor_quota({"role": "student", "sub": "stu-1"})
    assert exc.value.status_code == 429


def test_teacher_quota_unlimited():
    enforce_student_tutor_quota({"role": "teacher", "sub": "t-1"})
