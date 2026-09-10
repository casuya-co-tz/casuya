"""Teacher classroom profile routes — classroom creation and student/teacher
view of the connected class."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.classrooms.common import (
    ClassroomCreateRequest,
    _classroom_dict,
    _find_or_create_classroom,
    _get_student,
    _get_teacher,
)
from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.assignment import Assignment
from backend.models.classroom import Classroom, ClassroomEnrollment
from backend.models.lesson import Lesson
from backend.models.teacher import Teacher
from backend.models.user import User

router = APIRouter(tags=["classrooms"])


def _teacher_profile(db: Session, teacher: Teacher) -> dict:
    """Resolve a teacher's display fields (name, email, subjects)."""
    row = (
        db.query(User.full_name, User.email)
        .filter(User.id == teacher.user_id)
        .first()
    )
    name, email = (row if row else (None, None))
    return {
        "name": name,
        "email": email,
        "subjects": teacher.subjects,
    }


def _teacher_published_lessons(db: Session, teacher: Teacher, limit: int = 20) -> list[dict]:
    rows = (
        db.query(Lesson)
        .filter(Lesson.created_by == teacher.user_id, Lesson.status == "published")
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "title": l.title,
            "status": l.status,
        }
        for l in rows
    ]


def _teacher_assignments(db: Session, teacher: Teacher, limit: int = 20) -> list[dict]:
    rows = (
        db.query(Assignment, Lesson.title)
        .outerjoin(Lesson, Assignment.lesson_id == Lesson.id)
        .filter(Assignment.created_by == teacher.user_id)
        .order_by(Assignment.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "title": a.title,
            "lesson_id": a.lesson_id,
            "lesson_title": lesson_title,
            "due_date": a.due_date,
            "status": a.status,
            "has_paper": bool(a.paper_json),
        }
        for a, lesson_title in rows
    ]


@router.get("/me", response_model=dict)
@router.get("/me/", response_model=dict)
def get_my_classroom(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    role = current_user.get("role", "")
    if role == "teacher":
        teacher = _get_teacher(db, current_user["sub"])
        classroom = _find_or_create_classroom(db, teacher)
        return _classroom_dict(db, classroom, include_students=False)
    if role in ("student", "special_needs"):
        student = _get_student(db, current_user["sub"])
        enrollment = (
            db.query(ClassroomEnrollment, Classroom)
            .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
            .filter(
                ClassroomEnrollment.student_id == student.id,
                ClassroomEnrollment.status == "active",
            )
            .first()
        )
        if not enrollment:
            return {"classroom": None, "teacher": None}
        enrollment_row, classroom = enrollment
        teacher = db.get(Teacher, classroom.teacher_id)
        teacher_dict = None
        published_lessons: list[dict] = []
        assignments: list[dict] = []
        classmates_count = 0
        if teacher:
            teacher_dict = _teacher_profile(db, teacher)
            published_lessons = _teacher_published_lessons(db, teacher)
            assignments = _teacher_assignments(db, teacher)
        classmates_count = (
            db.query(ClassroomEnrollment)
            .filter(
                ClassroomEnrollment.classroom_id == classroom.id,
                ClassroomEnrollment.status == "active",
            )
            .count()
        )
        return {
            "classroom": _classroom_dict(db, classroom, include_students=False),
            "class_name": classroom.name,
            "teacher": teacher_dict,
            "classmates_count": classmates_count,
            "published_lessons": published_lessons,
            "assignments": assignments,
        }
    raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/me", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.post("/me/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def create_or_update_classroom(
    body: ClassroomCreateRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, current_user["sub"])
    classroom = _find_or_create_classroom(db, teacher)
    if body.name is not None and body.name.strip():
        classroom.name = body.name.strip()
    if classroom.lesson_limit is None:
        classroom.lesson_limit = 2
    db.commit()
    db.refresh(classroom)
    return _classroom_dict(db, classroom, include_students=True)
