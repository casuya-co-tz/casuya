"""Classroom connection endpoints.

Teacher creates their single class code (auto-generated on first access).
Students join by pasting/saving that code. Teachers see their connected
students; students see their connected teacher.
"""

from __future__ import annotations

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.classroom import Classroom, ClassroomEnrollment
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User

router = APIRouter(prefix="/classrooms", tags=["classrooms"])

_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


class JoinClassroomRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        return v.strip().upper()


class ClassroomCreateRequest(BaseModel):
    name: str | None = None


def _get_teacher(db: Session, user_id: str) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.user_id == user_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return teacher


def _get_student(db: Session, user_id: str) -> Student:
    student = db.query(Student).filter(Student.user_id == user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


def _find_or_create_classroom(db: Session, teacher: Teacher) -> Classroom:
    existing = db.query(Classroom).filter(Classroom.teacher_id == teacher.id).first()
    if existing:
        return existing

    for _attempt in range(10):
        code = _generate_code()
        try:
            classroom = Classroom(teacher_id=teacher.id, code=code)
            db.add(classroom)
            db.commit()
            db.refresh(classroom)
            return classroom
        except IntegrityError:
            db.rollback()
            continue
    raise HTTPException(status_code=500, detail="Could not generate unique classroom code")


def _classroom_dict(db: Session, classroom: Classroom, include_students: bool = False) -> dict:
    data = {
        "id": classroom.id,
        "teacher_id": classroom.teacher_id,
        "code": classroom.code,
        "name": classroom.name,
        "lesson_limit": classroom.lesson_limit,
        "created_at": classroom.created_at.isoformat() if classroom.created_at else None,
    }
    if include_students:
        data["students"] = _list_connected_students(db, classroom.id)
    return data


def _list_connected_students(db: Session, classroom_id: str) -> list[dict]:
    rows = (
        db.query(Student, User.email, ClassroomEnrollment.status, ClassroomEnrollment.joined_at)
        .join(ClassroomEnrollment, ClassroomEnrollment.student_id == Student.id)
        .outerjoin(User, User.id == Student.user_id)
        .filter(ClassroomEnrollment.classroom_id == classroom_id, ClassroomEnrollment.status == "active")
        .all()
    )
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "email": email,
            "full_name": s.full_name,
            "form_level": s.form_level,
            "school_code": s.school_code,
            "status": status,
            "joined_at": joined_at.isoformat() if joined_at else None,
        }
        for s, email, status, joined_at in rows
    ]


# --- Teacher routes ---


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
        teacher_name = None
        teacher_email = None
        if teacher:
            row = (
                db.query(User.full_name, User.email)
                .filter(User.id == teacher.user_id)
                .first()
            )
            if row:
                teacher_name, teacher_email = row
        return {
            "classroom": _classroom_dict(db, classroom, include_students=False),
            "teacher": {"name": teacher_name, "email": teacher_email},
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


@router.get("/me/students", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.get("/me/students/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def get_my_connected_students(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = _get_teacher(db, current_user["sub"])
    classroom = _find_or_create_classroom(db, teacher)
    students = _list_connected_students(db, classroom.id)
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


# --- Student routes ---


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
