from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

import csv
import io

from backend.config.database import get_db
from backend.middleware.cache import apply_public_cache, cache_get, cache_invalidate, cache_set
from backend.middleware.permissions import require_role
from backend.models.lesson import Subject, Topic
from backend.schemas.topics import TopicCreate, TopicResponse

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicResponse])
@router.get("/", response_model=list[TopicResponse])
def list_topics(
    subject_id: str | None = None,
    request: Request = None,
    response: Response = None,
    limit: int = Query(500, ge=1, le=2000),
):
    cache_key = f"topics:list:{subject_id or 'all'}:{limit}"
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
        query = db.query(Topic)
        if subject_id:
            query = query.filter(Topic.subject_id == subject_id)
        topics = query.order_by(Topic.title).limit(limit).all()
        result = [
            TopicResponse(id=t.id, subject_id=t.subject_id, title=t.title, form_level=t.form_level) for t in topics
        ]
        cache_set(cache_key, [r.model_dump() for r in result], ttl=600)
        if request is not None and response is not None:
            not_modified = apply_public_cache(response, request, result, max_age=300)
            if not_modified is not None:
                return not_modified
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


MAX_BULK_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_BULK_ROWS = 10000


def _resolve_subject(db: Session, slug: str | None, name: str | None) -> Subject | None:
    if slug:
        s = db.query(Subject).filter(Subject.slug == slug.strip()).first()
        if s:
            return s
    if name:
        # case-insensitive name match
        s = db.query(Subject).filter(Subject.name.ilike(name.strip())).first()
        if s:
            return s
    return None


@router.post("/bulk", dependencies=[Depends(require_role("admin"))])
async def bulk_upload_topics(file: UploadFile = File(...)):
    """Bulk-create topics from a CSV file.

    Expected columns (header row required):
      subject_slug  (or subject_name / subject_id), form_level, title

    Rows are processed independently; duplicates (same subject+title+form_level)
    are skipped, and per-row errors are reported without aborting the batch.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    if len(raw) > MAX_BULK_BYTES:
        raise HTTPException(status_code=413, detail="CSV too large (max 5 MB)")

    # Decode with BOM handling
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

    # Normalize header names
    fieldnames = [ (fn or "").strip().lower() for fn in reader.fieldnames ]
    reader.fieldnames = fieldnames

    required = {"title"}
    if not required.issubset(set(fieldnames)):
        raise HTTPException(status_code=400, detail="CSV must include a 'title' column")

    has_subject_ref = any(c in fieldnames for c in ("subject_slug", "subject_id", "subject_name", "subject"))
    if not has_subject_ref:
        raise HTTPException(status_code=400, detail="CSV must include a subject reference column (subject_slug/subject_id/subject_name)")

    _gen = get_db()
    db: Session = next(_gen)
    created = 0
    skipped = 0
    errors: list[dict] = []
    total = 0
    try:
        for row_num, row in enumerate(reader, start=2):  # row 1 is header
            if total >= MAX_BULK_ROWS:
                errors.append({"row": row_num, "reason": "row limit exceeded"})
                break
            total += 1
            # Normalize keys
            r = { (k or "").strip().lower(): (v if v is not None else "") for k, v in row.items() }
            title = (r.get("title") or "").strip()
            form_level = (r.get("form_level") or r.get("form") or "").strip()
            subject_slug = (r.get("subject_slug") or r.get("subject") or "").strip()
            subject_id = (r.get("subject_id") or "").strip()
            subject_name = (r.get("subject_name") or "").strip()

            if not title:
                errors.append({"row": row_num, "reason": "title is required"})
                continue

            subject = None
            if subject_id:
                subject = db.query(Subject).filter(Subject.id == subject_id).first()
            if subject is None:
                subject = _resolve_subject(db, subject_slug or None, subject_name or (subject_slug if not subject_slug else None))
            # fallback: treat subject_slug as name if no slug match
            if subject is None and subject_slug and not subject_name:
                subject = _resolve_subject(db, None, subject_slug)

            if subject is None:
                errors.append({"row": row_num, "reason": f"subject not found: {subject_slug or subject_name or subject_id}"})
                continue

            # Dedupe
            existing = db.query(Topic).filter(
                Topic.subject_id == subject.id,
                Topic.title == title,
                Topic.form_level == form_level,
            ).first()
            if existing:
                skipped += 1
                continue

            try:
                topic = Topic(subject_id=subject.id, title=title, form_level=form_level)
                db.add(topic)
                db.commit()
                created += 1
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                errors.append({"row": row_num, "reason": f"db error: {exc}"})
                continue

        cache_invalidate("topics:")
        cache_invalidate("subjects:")
    finally:
        _gen.close()

    return {
        "total": total,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "error_count": len(errors),
    }
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
