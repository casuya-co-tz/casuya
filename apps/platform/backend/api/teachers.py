from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.models.teacher import Teacher

router = APIRouter(prefix="/teachers", tags=["teachers"])


class TeacherUpdateRequest(BaseModel):
    full_name: str | None = None
    subjects: str | None = None
    school_code: str | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is not None and v.strip():
            return v.strip()
        return None


def _get_current_teacher(current_user: dict, db: Session) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user["sub"]).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return teacher


@router.get("")
@router.get("/")
def list_teachers(current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        teachers = db.query(Teacher).all()
        return [
            {
                "id": t.id,
                "user_id": t.user_id,
                "full_name": t.full_name,
                "subjects": t.subjects,
                "school_code": t.school_code,
            }
            for t in teachers
        ]
    finally:
        _gen.close()


@router.get("/me", response_model=dict)
@router.get("/me/", response_model=dict)
def get_my_profile(current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        teacher = _get_current_teacher(current_user, db)
        return {
            "id": teacher.id,
            "user_id": teacher.user_id,
            "full_name": teacher.full_name,
            "subjects": teacher.subjects,
            "school_code": teacher.school_code,
        }
    finally:
        _gen.close()


@router.patch("/me", response_model=dict)
@router.patch("/me/", response_model=dict)
def update_my_profile(body: TeacherUpdateRequest, current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        teacher = _get_current_teacher(current_user, db)
        if body.full_name is not None:
            teacher.full_name = body.full_name
        if body.subjects is not None:
            teacher.subjects = body.subjects
        if body.school_code is not None:
            teacher.school_code = body.school_code
        db.commit()
        return {
            "id": teacher.id,
            "user_id": teacher.user_id,
            "full_name": teacher.full_name,
            "subjects": teacher.subjects,
            "school_code": teacher.school_code,
        }
    finally:
        _gen.close()


@router.get("/{teacher_id}")
@router.get("/{teacher_id}/")
def get_teacher(teacher_id: str, current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if not teacher:
            return {"error": "not_found"}
        return {
            "id": teacher.id,
            "user_id": teacher.user_id,
            "full_name": teacher.full_name,
            "subjects": teacher.subjects,
            "school_code": teacher.school_code,
        }
    finally:
        _gen.close()
