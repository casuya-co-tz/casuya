from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy.orm import Session

import csv
import io

from backend.config.database import get_db
from backend.middleware.cache import apply_public_cache, cache_get, cache_invalidate, cache_set
from backend.middleware.permissions import require_role
from backend.models.lesson import Subtopic, Topic, Subject
from backend.schemas.subtopics import SubtopicCreate, SubtopicResponse

router = APIRouter(prefix="/subtopics", tags=["subtopics"])


@router.get("", response_model=list[SubtopicResponse])
@router.get("/", response_model=list[SubtopicResponse])
def list_subtopics(topic_id: str | None = None, request: Request = None, response: Response = None):
    cache_key = f"subtopics:list:{topic_id or 'all'}"
    cached = cache_get(cache_key, ttl_seconds=600)
    if cached is not None:
        if request is not None and response is not None:
            not_modified = apply_public_cache(response, request, cached, max_age=300)
            if not_modified is not None:
                return not_modified
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
        if request is not None and response is not None:
            not_modified = apply_public_cache(response, request, result, max_age=300)
            if not_modified is not None:
                return not_modified
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


MAX_BULK_BYTES = 5 * 1024 * 1024
MAX_BULK_ROWS = 10000


def _resolve_subject(db: Session, slug: str | None, name: str | None):
    if slug:
        s = db.query(Subject).filter(Subject.slug == slug.strip()).first()
        if s:
            return s
    if name:
        s = db.query(Subject).filter(Subject.name.ilike(name.strip())).first()
        if s:
            return s
    return None


def _resolve_topic(db: Session, subject_id: str, form_level: str, title: str):
    q = db.query(Topic).filter(Topic.subject_id == subject_id, Topic.title == title)
    if form_level:
        q = q.filter(Topic.form_level == form_level)
    return q.first()


@router.post("/bulk", dependencies=[Depends(require_role("admin"))])
async def bulk_upload_subtopics(file: UploadFile = File(...)):
    """Bulk-create subtopics from a CSV file.

    Expected columns (header row required):
      subject_slug (or subject_id/subject_name), form_level, topic_title, title
      OR topic_id, title

    Rows are processed independently; duplicates (same topic+title) are skipped.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    if len(raw) > MAX_BULK_BYTES:
        raise HTTPException(status_code=413, detail="CSV too large (max 5 MB)")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to decode CSV (use UTF-8)")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV is empty or has no header row")

    fieldnames = [(fn or "").strip().lower() for fn in reader.fieldnames]
    reader.fieldnames = fieldnames

    if "title" not in fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include a 'title' column (subtopic title)")

    has_topic_ref = ("topic_id" in fieldnames) or any(c in fieldnames for c in ("topic_title", "topic"))
    if not has_topic_ref:
        raise HTTPException(status_code=400, detail="CSV must include topic_id or topic_title")

    _gen = get_db()
    db: Session = next(_gen)
    created = 0
    skipped = 0
    errors: list[dict] = []
    total = 0
    try:
        for row_num, row in enumerate(reader, start=2):
            if total >= MAX_BULK_ROWS:
                errors.append({"row": row_num, "reason": "row limit exceeded"})
                break
            total += 1
            r = {(k or "").strip().lower(): (v if v is not None else "") for k, v in row.items()}
            title = (r.get("title") or "").strip()
            topic_id = (r.get("topic_id") or "").strip()
            topic_title = (r.get("topic_title") or r.get("topic") or "").strip()
            form_level = (r.get("form_level") or r.get("form") or "").strip()
            subject_slug = (r.get("subject_slug") or r.get("subject") or "").strip()
            subject_id = (r.get("subject_id") or "").strip()
            subject_name = (r.get("subject_name") or "").strip()

            if not title:
                errors.append({"row": row_num, "reason": "title is required"})
                continue

            topic = None
            if topic_id:
                topic = db.query(Topic).filter(Topic.id == topic_id).first()
            else:
                subject = None
                if subject_id:
                    subject = db.query(Subject).filter(Subject.id == subject_id).first()
                if subject is None:
                    subject = _resolve_subject(db, subject_slug or None, subject_name or None)
                    if subject is None and subject_slug and not subject_name:
                        subject = _resolve_subject(db, None, subject_slug)
                if subject is None:
                    errors.append({"row": row_num, "reason": f"subject not found: {subject_slug or subject_name or subject_id}"})
                    continue
                topic = _resolve_topic(db, subject.id, form_level, topic_title)
                if topic is None:
                    errors.append({"row": row_num, "reason": f"topic not found: {topic_title} (subject={subject.slug}, form={form_level})"})
                    continue

            existing = db.query(Subtopic).filter(Subtopic.topic_id == topic.id, Subtopic.title == title).first()
            if existing:
                skipped += 1
                continue

            try:
                sub = Subtopic(topic_id=topic.id, title=title)
                db.add(sub)
                db.commit()
                created += 1
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                errors.append({"row": row_num, "reason": f"db error: {exc}"})
                continue

        cache_invalidate("subtopics:")
        cache_invalidate("topics:")
    finally:
        _gen.close()

    return {
        "total": total,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "error_count": len(errors),
    }


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
