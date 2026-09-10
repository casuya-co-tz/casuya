"""Teacher classroom roster routes — connected students and class code
regeneration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.classrooms.common import (
    _classroom_dict,
    _find_or_create_classroom,
    _generate_code,
    _get_teacher,
    _list_connected_students,
)
from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.assignment import AssignmentSubmission
from backend.models.progress import ProgressRecord
from backend.models.student import Student

router = APIRouter(tags=["classrooms"])


def _student_class_stats(db: Session, student: Student) -> dict:
    """Quick engagement snapshot for a teacher's roster view."""
    completed = (
        db.query(ProgressRecord)
        .filter(ProgressRecord.student_id == student.id, ProgressRecord.completion_percentage >= 100)
        .count()
    )
    avg_score = (
        db.query(func.avg(ProgressRecord.score_percentage))
        .filter(ProgressRecord.student_id == student.id, ProgressRecord.score_percentage > 0)
        .scalar()
    )
    submissions = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.student_id == student.id)
        .count()
    )
    return {
        "lessons_completed": completed,
        "avg_score": round(float(avg_score)) if avg_score is not None else 0,
        "assignments_submitted": submissions,
    }


@router.get("/me/students", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.get("/me/students/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def get_my_connected_students(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = _get_teacher(db, current_user["sub"])
    classroom = _find_or_create_classroom(db, teacher)
    students = _list_connected_students(db, classroom.id)
    for entry in students:
        student = db.get(Student, entry["id"])
        entry["stats"] = _student_class_stats(db, student) if student else {
            "lessons_completed": 0,
            "avg_score": 0,
            "assignments_submitted": 0,
        }
    return {"classroom": _classroom_dict(db, classroom, include_students=False), "students": students, "total": len(students)}


@router.post("/me/code/regenerate", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.post("/me/code/regenerate/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def regenerate_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = _get_teacher(db, current_user["sub"])
    classroom = _find_or_create_classroom(db, teacher)

    for _attempt in range(10):
        code = _generate_code()
        try:
            classroom.code = code
            db.commit()
            return {"code": code}
        except IntegrityError:
            db.rollback()
            continue
    raise HTTPException(status_code=500, detail="Could not generate unique code")
