from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.cache import cache_get, cache_invalidate, cache_set, etag_for
from backend.middleware.permissions import require_role
from backend.models.lesson import Topic
from backend.schemas.topics import TopicCreate, TopicResponse

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
@router.get("/", response_model=list[TopicResponse])
def list_topics(subject_id: str | None = None):
    cache_key = f"topics:list:{subject_id or 'all'}"
    cached = cache_get(cache_key, ttl_seconds=600)
    if cached is not None:
        return cached
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(Topic)
        if subject_id:
            query = query.filter(Topic.subject_id == subject_id)
        topics = query.all()
        result = [
            TopicResponse(id=t.id, subject_id=t.subject_id, title=t.title, form_level=t.form_level) for t in topics
        ]
        cache_set(cache_key, [r.model_dump() for r in result], ttl=600)
        return result
    finally:
        _gen.close()


@router.post("", response_model=TopicResponse, dependencies=[Depends(require_role("admin"))])
@router.post("/", response_model=TopicResponse, dependencies=[Depends(require_role("admin"))])
def create_topic(body: TopicCreate):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        topic = Topic(subject_id=body.subject_id, title=body.title, form_level=body.form_level)
        db.add(topic)
        db.commit()
        cache_invalidate("topics:")
        return TopicResponse(id=topic.id, subject_id=topic.subject_id, title=topic.title, form_level=topic.form_level)
    finally:
        _gen.close()


@router.delete("/{topic_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{topic_id}/", dependencies=[Depends(require_role("admin"))])
def delete_topic(topic_id: str):
    from fastapi import HTTPException

    _gen = get_db()
    db: Session = next(_gen)
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        try:
            db.delete(topic)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Cannot delete: topic has related subtopics. Delete subtopics first."
            )
        cache_invalidate("topics:")
        return {"detail": "Topic deleted"}
    finally:
        _gen.close()
