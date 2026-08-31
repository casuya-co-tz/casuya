from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.student import Student
from backend.models.user import User

VALID_FORM_LEVELS = ["Form I", "Form II", "Form III", "Form IV", "Form V", "Form VI"]


class StudentUpdateRequest(BaseModel):
    full_name: str | None = None
    form_level: str | None = None
    school_code: str | None = None

    @field_validator("form_level")
    @classmethod
    def validate_form_level(cls, v: str | None) -> str | None:
        if v is not None and v.strip():
            if v not in VALID_FORM_LEVELS:
                raise ValueError(f"Invalid form level. Must be one of: {', '.join(VALID_FORM_LEVELS)}")
            return v
        return None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is not None and v.strip():
            return v.strip()
        return None


router = APIRouter(prefix="/students", tags=["students"])


def _get_current_student(current_user: dict, db: Session) -> Student:
    student = db.query(Student).filter(Student.user_id == current_user["sub"]).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


@router.get("", dependencies=[Depends(require_role("student", "teacher", "admin"))])
@router.get("/", dependencies=[Depends(require_role("student", "teacher", "admin"))])
def list_students(
    current_user=Depends(get_current_user),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    role = current_user.get("role", "")
    if role == "student":
        student = db.query(Student).filter(Student.user_id == current_user["sub"]).first()
        if not student:
            return {"items": [], "total": 0, "offset": 0, "limit": limit}
        email = db.query(User.email).filter(User.id == student.user_id).scalar()
        return {
            "items": [{
                "id": student.id,
                "user_id": student.user_id,
                "email": email,
                "full_name": student.full_name,
                "form_level": student.form_level,
                "school_code": student.school_code,
            }],
            "total": 1,
            "offset": 0,
            "limit": 1,
        }
    total = db.query(Student).count()
    rows = (
        db.query(Student, User.email)
        .outerjoin(User, Student.user_id == User.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "email": email,
                "full_name": s.full_name,
                "form_level": s.form_level,
                "school_code": s.school_code,
            }
            for s, email in rows
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/me", response_model=dict)
@router.get("/me/", response_model=dict)
def get_my_profile(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = _get_current_student(current_user, db)
    email = db.query(User.email).filter(User.id == student.user_id).scalar()
    return {
        "id": student.id,
        "user_id": student.user_id,
        "email": email,
        "full_name": student.full_name,
        "form_level": student.form_level,
        "school_code": student.school_code,
    }


@router.patch("/me", response_model=dict)
@router.patch("/me/", response_model=dict)
def update_my_profile(body: StudentUpdateRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = _get_current_student(current_user, db)
    if body.full_name is not None:
        student.full_name = body.full_name
    if body.form_level is not None:
        student.form_level = body.form_level
    if body.school_code is not None:
        student.school_code = body.school_code
    db.commit()
    email = db.query(User.email).filter(User.id == student.user_id).scalar()
    return {
        "id": student.id,
        "user_id": student.user_id,
        "email": email,
        "full_name": student.full_name,
        "form_level": student.form_level,
        "school_code": student.school_code,
    }


@router.get("/{student_id}")
@router.get("/{student_id}/")
def get_student(student_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {"error": "not_found"}
    role = current_user.get("role", "")
    if role not in ("admin", "teacher") and not (role == "student" and student.user_id == current_user["sub"]):
        raise HTTPException(status_code=403, detail="Not authorized to view this student")
    email = db.query(User.email).filter(User.id == student.user_id).scalar()
    return {
        "id": student.id,
        "user_id": student.user_id,
        "email": email,
        "full_name": student.full_name,
        "form_level": student.form_level,
        "school_code": student.school_code,
    }
