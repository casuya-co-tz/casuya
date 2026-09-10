"""Student classroom routes — join and leave a teacher's class."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.classrooms.common import (
    JoinClassroomRequest,
    _classroom_dict,
    _get_student,
)
from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.classroom import Classroom, ClassroomEnrollment
from backend.models.teacher import Teacher
from backend.models.user import User

router = APIRouter(tags=["classrooms"])


@router.post("/join", response_model=dict, dependencies=[Depends(require_role("student", "special_needs"))])
@router.post("/join/", response_model=dict, dependencies=[Depends(require_role("student", "special_needs"))])
def join_classroom(body: JoinClassroomRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = _get_student(db, current_user["sub"])
    if not body.code:
        raise HTTPException(status_code=400, detail="Class code is required")

    classroom = db.query(Classroom).filter(Classroom.code == body.code).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid class code. Check with your teacher and try again.")

    existing = (
        db.query(ClassroomEnrollment)
        .filter(ClassroomEnrollment.student_id == student.id)
        .first()
    )
    if existing:
        if existing.classroom_id == classroom.id:
            return {
                "status": "already_joined",
                "classroom": _classroom_dict(db, classroom),
                "message": "You are already connected to this class.",
            }
        # Leave previous class, join the new one.
        existing.status = "inactive"
        db.add(existing)

    new_enrollment = ClassroomEnrollment(classroom_id=classroom.id, student_id=student.id)
    db.add(new_enrollment)
    db.commit()

    teacher = db.get(Teacher, classroom.teacher_id)
    teacher_name = None
    if teacher:
        teacher_name = db.query(User.full_name).filter(User.id == teacher.user_id).scalar()

    return {
        "status": "joined",
        "classroom": _classroom_dict(db, classroom),
        "teacher_name": teacher_name,
        "message": "Connected! You are now in your teacher's class.",
    }


@router.post("/leave", response_model=dict, dependencies=[Depends(require_role("student", "special_needs"))])
@router.post("/leave/", response_model=dict, dependencies=[Depends(require_role("student", "special_needs"))])
def leave_classroom(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = _get_student(db, current_user["sub"])
    enrollment = (
        db.query(ClassroomEnrollment)
        .filter(ClassroomEnrollment.student_id == student.id, ClassroomEnrollment.status == "active")
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="You are not connected to any class.")
    enrollment.status = "inactive"
    db.commit()
    return {"status": "left"}
