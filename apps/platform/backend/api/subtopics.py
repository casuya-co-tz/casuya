from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.cache import cache_get, cache_invalidate, cache_set
from backend.middleware.permissions import require_role
from backend.models.lesson import Subtopic
from backend.schemas.subtopics import SubtopicCreate, SubtopicResponse

router = APIRouter(prefix="/subtopics", tags=["subtopics"])


@router.get("", response_model=list[SubtopicResponse])
@router.get("/", response_model=list[SubtopicResponse])
def list_subtopics(topic_id: str | None = None):
    cache_key = f"subtopics:list:{topic_id or 'all'}"
    cached = cache_get(cache_key, ttl_seconds=600)
    if cached is not None:
        return cached
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(Subtopic)
        if topic_id:
            query = query.filter(Subtopic.topic_id == topic_id)
        subtopics = query.all()
        result = [SubtopicResponse(id=s.id, topic_id=s.topic_id, title=s.title) for s in subtopics]
        cache_set(cache_key, [r.model_dump() for r in result], ttl=600)
        return result
    finally:
        _gen.close()


@router.post("", response_model=SubtopicResponse, dependencies=[Depends(require_role("admin"))])
@router.post("/", response_model=SubtopicResponse, dependencies=[Depends(require_role("admin"))])
def create_subtopic(body: SubtopicCreate):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subtopic = Subtopic(topic_id=body.topic_id, title=body.title)
        db.add(subtopic)
        db.commit()
        cache_invalidate("subtopics:")
        return SubtopicResponse(id=subtopic.id, topic_id=subtopic.topic_id, title=subtopic.title)
    finally:
        _gen.close()


@router.delete("/{subtopic_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{subtopic_id}/", dependencies=[Depends(require_role("admin"))])
def delete_subtopic(subtopic_id: str):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
        if not subtopic:
            raise HTTPException(status_code=404, detail="Subtopic not found")
        try:
            db.delete(subtopic)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Cannot delete: subtopic has related lessons. Delete lessons first."
            )
        cache_invalidate("subtopics:")
        cache_invalidate("lessons:")
        return {"detail": "Subtopic deleted"}
    finally:
        _gen.close()
