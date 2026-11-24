"""Aggregated student dashboard payload.

The old docstring claimed "one round-trip instead of five", which was not
true: profile, classroom, teacher, subjects and progress were resolved in
separate queries. Profile+email and classroom+teacher are now each fetched
with a single joined query, subjects are cached, and progress is aggregated
server-side. A literal single query would require four outer joins across
unrelated aggregates and would be slower on the target low-end/2G stack.
"""

from __future__ import annotations

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.api.classrooms.common import _classroom_dict
from backend.middleware.cache import cache_get, cache_set
from backend.models.classroom import Classroom, ClassroomEnrollment
from backend.models.lesson import Lesson, Subject, Subtopic, Topic
from backend.models.progress import ProgressRecord
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User
from backend.services.progress_service import compute_student_stats


def _profile_dict(student: Student, email: str | None) -> dict:
    return {
        "id": student.id,
        "user_id": student.user_id,
        "email": email,
        "full_name": student.full_name,
        "form_level": student.form_level,
        "school_code": student.school_code,
    }


def _classroom_payload(db: Session, student: Student) -> dict:
    """Resolve classroom, teacher and teacher email in one outer join."""
    row = (
        db.query(Classroom, Teacher, User.full_name, User.email)
        .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
        .outerjoin(Teacher, Teacher.id == Classroom.teacher_id)
        .outerjoin(User, User.id == Teacher.user_id)
        .filter(
            ClassroomEnrollment.student_id == student.id,
            ClassroomEnrollment.status == "active",
        )
        .first()
    )
    if not row:
        return {"classroom": None, "teacher": None}
    classroom, teacher, name, email = row
    teacher_dict = None
    if teacher:
        teacher_dict = {"name": name, "email": email, "subjects": teacher.subjects}
    return {
        "classroom": _classroom_dict(db, classroom, include_students=False),
        "teacher": teacher_dict,
    }


def _subjects(db: Session) -> list[dict]:
    cached = cache_get("subjects:list:500", ttl_seconds=600)
    if cached is not None:
        return cached
    rows = (
        db.query(Subject.id, Subject.name, Subject.slug)
        .order_by(Subject.name)
        .limit(500)
        .all()
    )
    result = [{"id": r.id, "name": r.name, "slug": r.slug} for r in rows]
    cache_set("subjects:list:500", result, ttl=600)
    return result


def _progress_by_subject(db: Session, student_id: str) -> list[dict]:
    rows = (
        db.query(
            Subject.name.label("name"),
            func.count(ProgressRecord.lesson_id).label("total"),
            func.coalesce(
                func.sum(case((ProgressRecord.completion_percentage >= 100, 1), else_=0)),
                0,
            ).label("completed"),
        )
        .select_from(ProgressRecord)
        .join(Lesson, ProgressRecord.lesson_id == Lesson.id, isouter=True)
        .join(Subtopic, Lesson.subtopic_id == Subtopic.id, isouter=True)
        .join(Topic, Subtopic.topic_id == Topic.id, isouter=True)
        .join(Subject, Topic.subject_id == Subject.id, isouter=True)
        .filter(ProgressRecord.student_id == student_id)
        .group_by(Subject.name)
        .all()
    )
    return [
        {
            "name": r.name or "General",
            "total": int(r.total or 0),
            "completed": int(r.completed or 0),
        }
        for r in rows
    ]


def build_student_dashboard(db: Session, user: dict) -> dict:
    row = (
        db.query(Student, User.email)
        .outerjoin(User, User.id == Student.user_id)
        .filter(Student.user_id == user["sub"])
        .first()
    )
    if not row:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Student profile not found")
    student, email = row

    stats = compute_student_stats(db, student.id)
    progress_by_subject = _progress_by_subject(db, student.id)
    total_completed = sum(p["completed"] for p in progress_by_subject)
    return {
        "profile": _profile_dict(student, email),
        "classroom": _classroom_payload(db, student),
        "subjects": _subjects(db),
        "progress_by_subject": progress_by_subject,
        "stats": {**stats, "totalCompleted": total_completed},
    }
