from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.teacher import Teacher
from backend.models.user import User

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


@router.get("", dependencies=[Depends(require_role("admin", "teacher"))])
@router.get("/", dependencies=[Depends(require_role("admin", "teacher"))])
def list_teachers(
    current_user=Depends(get_current_user),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    total = db.query(Teacher).count()
    teachers = (
        db.query(Teacher, User.email)
        .outerjoin(User, Teacher.user_id == User.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "email": email,
                "full_name": t.full_name,
                "subjects": t.subjects,
                "school_code": t.school_code,
            }
            for t, email in teachers
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/me", response_model=dict)
@router.get("/me/", response_model=dict)
def get_my_profile(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = _get_current_teacher(current_user, db)
    email = db.query(User.email).filter(User.id == teacher.user_id).scalar()
    return {
        "id": teacher.id,
        "user_id": teacher.user_id,
        "email": email,
        "full_name": teacher.full_name,
        "subjects": teacher.subjects,
        "school_code": teacher.school_code,
    }


@router.patch("/me", response_model=dict)
@router.patch("/me/", response_model=dict)
def update_my_profile(body: TeacherUpdateRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = _get_current_teacher(current_user, db)
    if body.full_name is not None:
        teacher.full_name = body.full_name
    if body.subjects is not None:
        teacher.subjects = body.subjects
    if body.school_code is not None:
        teacher.school_code = body.school_code
    db.commit()
    email = db.query(User.email).filter(User.id == teacher.user_id).scalar()
    return {
        "id": teacher.id,
        "user_id": teacher.user_id,
        "email": email,
        "full_name": teacher.full_name,
        "subjects": teacher.subjects,
        "school_code": teacher.school_code,
    }


@router.get("/{teacher_id}")
@router.get("/{teacher_id}/")
def get_teacher(teacher_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        return {"error": "not_found"}
    role = current_user.get("role", "")
    if role not in ("admin", "teacher") and not (role == "teacher" and teacher.user_id == current_user["sub"]):
        raise HTTPException(status_code=403, detail="Not authorized to view this teacher")
    email = db.query(User.email).filter(User.id == teacher.user_id).scalar()
    return {
        "id": teacher.id,
        "user_id": teacher.user_id,
        "email": email,
        "full_name": teacher.full_name,
        "subjects": teacher.subjects,
        "school_code": teacher.school_code,
    }
