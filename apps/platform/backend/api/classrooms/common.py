"""Shared helpers for the classroom connection endpoints."""

from __future__ import annotations

import secrets
import string

from fastapi import HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.classroom import Classroom, ClassroomEnrollment
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User

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
