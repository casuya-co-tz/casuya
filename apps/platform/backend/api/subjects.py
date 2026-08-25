from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.cache import cache_get, cache_invalidate, cache_set, etag_for
from backend.middleware.permissions import require_role
from backend.models.lesson import Subject
from backend.schemas.subjects import SubjectCreate, SubjectResponse

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectResponse])
@router.get("/", response_model=list[SubjectResponse])
def list_subjects():
    cached = cache_get("subjects:list", ttl_seconds=600)
    if cached is not None:
        return cached
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subjects = db.query(Subject).all()
        result = [SubjectResponse(id=s.id, name=s.name, slug=s.slug) for s in subjects]
        cache_set("subjects:list", [r.model_dump() for r in result], ttl=600)
        return result
    finally:
        _gen.close()


@router.post("", response_model=SubjectResponse, dependencies=[Depends(require_role("admin"))])
@router.post("/", response_model=SubjectResponse, dependencies=[Depends(require_role("admin"))])
def create_subject(body: SubjectCreate):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        if db.query(Subject).filter(Subject.slug == body.slug).first():
            raise HTTPException(status_code=409, detail="Subject slug already exists")
        subject = Subject(name=body.name, slug=body.slug)
        db.add(subject)
        db.commit()
        cache_invalidate("subjects:")
        return SubjectResponse(id=subject.id, name=subject.name, slug=subject.slug)
    finally:
        _gen.close()


@router.delete("/{subject_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{subject_id}/", dependencies=[Depends(require_role("admin"))])
def delete_subject(subject_id: str):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        try:
            db.delete(subject)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Cannot delete: subject has related topics. Delete topics first."
            )
        cache_invalidate("subjects:")
        return {"detail": "Subject deleted"}
    finally:
        _gen.close()
