"""Aggregated teacher dashboard payload (one round-trip instead of four)."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.classrooms.common import (
    _classroom_dict,
    _find_or_create_classroom,
    _get_teacher,
)
from backend.models.bookmark import Bookmark
from backend.models.classroom import ClassroomEnrollment
from backend.models.lesson import Lesson
from backend.services.analytics_service import get_platform_overview


def build_teacher_dashboard(db: Session, user: dict) -> dict:
    teacher = _get_teacher(db, user["sub"])
    classroom = _find_or_create_classroom(db, teacher)
    student_total = (
        db.query(func.count(ClassroomEnrollment.id))
        .filter(
            ClassroomEnrollment.classroom_id == classroom.id,
            ClassroomEnrollment.status == "active",
        )
        .scalar()
        or 0
    )
    lesson_count = (
        db.query(func.count(Lesson.id)).filter(Lesson.status == "published").scalar() or 0
    )
    bookmark_count = (
        db.query(func.count(Bookmark.id)).filter(Bookmark.user_id == user["sub"]).scalar() or 0
    )
    return {
        "overview": get_platform_overview(),
        "lesson_count": int(lesson_count),
        "classroom": {
            "classroom": _classroom_dict(db, classroom, include_students=False),
            "total": int(student_total),
        },
        "bookmark_count": int(bookmark_count),
    }
