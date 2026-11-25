"""Reference library endpoints — browse and search imported official lessons/schemes.

Read-only, public access (same pattern as syllabus browsing). Documents are
imported from the public reference platform by the import script and stored in
``reference_docs``.  Admin-only endpoints for managing student visibility are
protected by the standard ``require_role("admin")`` dependency.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.cache import apply_public_cache, cache_get, cache_invalidate, cache_set
from backend.middleware.permissions import require_role
from backend.services.reference_library_service import (
    count_reference_docs,
    get_reference_doc,
    list_reference_docs,
    render_reference_lesson_plan_html,
    render_reference_scheme_html,
    serialize_doc,
)

router = APIRouter(prefix="/reference-docs", tags=["reference-docs"])

_VALID_TYPES = ("lesson_plan", "scheme_of_work")


@router.get("")
@router.get("/")
def api_list_reference_docs(
    response: Response,
    request: Request,
    doc_type: str | None = Query(default=None),
    subject_slug: str | None = Query(default=None),
    form_level: int | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    if doc_type is not None and doc_type not in _VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"doc_type must be one of {_VALID_TYPES}")
    cache_key = f"reference_docs:list:{doc_type or ''}:{subject_slug or ''}:{form_level or ''}:{query or ''}:{limit}:{offset}"
    cached = cache_get(cache_key, ttl_seconds=300)
    if cached is not None:
        not_modified = apply_public_cache(response, request, cached, max_age=300)
        if not_modified is not None:
            return not_modified
        return cached

    docs = list_reference_docs(
        db,
        doc_type=doc_type,
        subject_slug=subject_slug,
        form_level=form_level,
        query=query,
        limit=limit,
        offset=offset,
    )
    result = {
        "total": count_reference_docs(
            db,
            doc_type=doc_type,
            subject_slug=subject_slug,
            form_level=form_level,
            query=query,
        ),
        "offset": offset,
        "limit": limit,
        "items": [serialize_doc(d) for d in docs],
    }
    cache_set(cache_key, result, ttl=300)
    not_modified = apply_public_cache(response, request, result, max_age=300)
    if not_modified is not None:
        return not_modified
    return result


@router.get("/stats")
@router.get("/stats/")
def api_reference_docs_stats(response: Response, request: Request, db: Session = Depends(get_db)):
    cache_key = "reference_docs:stats"
    cached = cache_get(cache_key, ttl_seconds=300)
    if cached is not None:
        not_modified = apply_public_cache(response, request, cached, max_age=300)
        if not_modified is not None:
            return not_modified
        return cached

    from sqlalchemy import func

    from backend.models.reference_doc import ReferenceDoc

    rows = (
        db.query(ReferenceDoc.doc_type, func.count(ReferenceDoc.id))
        .group_by(ReferenceDoc.doc_type)
        .all()
    )
    counts = {row[0]: row[1] for row in rows}
    result = {
        "lesson_plans": counts.get("lesson_plan", 0),
        "schemes_of_work": counts.get("scheme_of_work", 0),
        "total": sum(counts.values()),
    }
    cache_set(cache_key, result, ttl=300)
    not_modified = apply_public_cache(response, request, result, max_age=300)
    if not_modified is not None:
        return not_modified
    return result


@router.get("/student")
@router.get("/student/")
def api_student_reference_docs(
    response: Response,
    request: Request,
    doc_type: str | None = Query(default=None),
    subject_slug: str | None = Query(default=None),
    form_level: int | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Student-facing endpoint: only returns docs where visible_to_students=True."""
    cache_key = f"reference_docs:student:{doc_type or ''}:{subject_slug or ''}:{form_level or ''}:{query or ''}:{limit}:{offset}"
    cached = cache_get(cache_key, ttl_seconds=300)
    if cached is not None:
        not_modified = apply_public_cache(response, request, cached, max_age=300)
        if not_modified is not None:
            return not_modified
        return cached

    from sqlalchemy import or_

    from backend.models.reference_doc import ReferenceDoc

    q = db.query(ReferenceDoc).filter(ReferenceDoc.visible_to_students == True)  # noqa: E712
    if doc_type in _VALID_TYPES:
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    if subject_slug:
        q = q.filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
    if query:
        like = f"%{query}%"
        q = q.filter(
            or_(
                ReferenceDoc.title.ilike(like),
                ReferenceDoc.subject_name.ilike(like),
            )
        )
    total = q.count()
    items = (
        q.order_by(
            ReferenceDoc.doc_type.asc(),
            ReferenceDoc.form_level.asc(),
            ReferenceDoc.title.asc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    result = {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [serialize_doc(d) for d in items],
    }
    cache_set(cache_key, result, ttl=300)
    not_modified = apply_public_cache(response, request, result, max_age=300)
    if not_modified is not None:
        return not_modified
    return result


@router.get("/{doc_id}")
@router.get("/{doc_id}/")
def api_get_reference_doc(doc_id: str, response: Response, request: Request, db: Session = Depends(get_db)):
    cache_key = f"reference_docs:detail:{doc_id}"
    cached = cache_get(cache_key, ttl_seconds=600)
    if cached is not None:
        not_modified = apply_public_cache(response, request, cached, max_age=600)
        if not_modified is not None:
            return not_modified
        return cached
    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    result = serialize_doc(doc)
    cache_set(cache_key, result, ttl=600)
    not_modified = apply_public_cache(response, request, result, max_age=600)
    if not_modified is not None:
        return not_modified
    return result


@router.get("/{doc_id}/render")
@router.get("/{doc_id}/render/")
def api_render_reference_doc(doc_id: str, request: Request, db: Session = Depends(get_db)):
    """Return the reference document rendered as an HTML string."""
    import hashlib
    import json as _json

    from fastapi.responses import HTMLResponse

    cache_key = f"reference_docs:render:{doc_id}"
    cached_html = cache_get(cache_key, ttl_seconds=600)
    if isinstance(cached_html, str):
        etag = '"' + hashlib.sha256(cached_html.encode("utf-8")).hexdigest()[:16] + '"'
        headers = {"Cache-Control": "public, max-age=600", "ETag": etag}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        return HTMLResponse(content=cached_html, headers=headers)

    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    try:
        content = _json.loads(doc.content)
    except (TypeError, ValueError):
        content = {}
    # File-backed documents (uploaded by admin) are served directly.
    if isinstance(content, dict) and content.get("file_url"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=content["file_url"], status_code=307)
    if doc.doc_type == "scheme_of_work":
        html = render_reference_scheme_html(content)
    else:
        html = render_reference_lesson_plan_html(content)
    cache_set(cache_key, html, ttl=600)
    etag = '"' + hashlib.sha256(html.encode("utf-8")).hexdigest()[:16] + '"'
    headers = {"Cache-Control": "public, max-age=600", "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return HTMLResponse(content=html, headers=headers)


# ── Admin endpoints ────────────────────────────────────────────────────


class _VisibilityPayload(BaseModel):
    visible_to_students: bool


@router.post("/upload", dependencies=[Depends(require_role("admin"))])
async def api_upload_reference_doc(
    file: UploadFile = File(...),
    doc_type: str = Form("lesson_plan"),
    title: str = Form(""),
    subject_slug: str = Form(""),
    form_level: str = Form(""),
):
    """Upload a file (PDF/DOCX/HTML/TXT) as a reference library document.

    The file is stored under the uploads storage root and a ReferenceDoc row is
    created pointing at it, so teachers/students can open/download it.
    """
    import json as _json
    import uuid as _uuid
    from pathlib import Path

    from backend.config.settings import get_settings
    from backend.models.reference_doc import ReferenceDoc
    from backend.models.lesson import Subject

    if doc_type not in _VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"doc_type must be one of {_VALID_TYPES}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    # Sanitize filename
    raw_name = file.filename
    if "/" in raw_name or "\\" in raw_name or ".." in raw_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    safe_name = raw_name

    content_bytes = await file.read()
    if len(content_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    from backend.services.upload_service import store_upload
    stored_path = store_upload(content_bytes, safe_name, "documents")
    # store_upload may return R2 key (kind/name) or local path; normalize filename from it
    safe_name = Path(stored_path).name

    # Resolve subject name
    subject_name = None
    slug = subject_slug.strip() or None
    if slug:
        _gen = get_db()
        db_tmp = next(_gen)
        try:
            subj = db_tmp.query(Subject).filter(Subject.slug == slug).first()
            if subj:
                subject_name = subj.name
        finally:
            _gen.close()

    # Parse form_level
    fl = None
    if form_level.strip():
        try:
            fl = int(form_level.strip())
        except ValueError:
            fl = None

    resolved_title = title.strip() or Path(safe_name).stem

    # Unique source_id per doc_type
    db = next(get_db())
    try:
        source_id = safe_name
        existing = db.query(ReferenceDoc).filter(
            ReferenceDoc.doc_type == doc_type, ReferenceDoc.source_id == source_id
        ).first()
        if existing:
            source_id = f"{safe_name}-{_uuid.uuid4().hex[:6]}"

        doc = ReferenceDoc(
            doc_type=doc_type,
            source_id=source_id,
            source_url=f"/uploads/documents/{safe_name}",
            title=resolved_title,
            subject_name=subject_name,
            subject_slug=slug,
            form_level=fl,
            standard=None,
            content=_json.dumps({
                "file_url": f"/uploads/documents/{safe_name}",
                "file_name": safe_name,
                "mime": file.content_type or "application/octet-stream",
                "title": resolved_title,
            }),
            visible_to_students=False,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        cache_invalidate("reference_docs:")
        return serialize_doc(doc)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        # Best-effort cleanup of the written file
        try:
            dest.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to register document: {exc}")
    finally:
        db.close()


@router.delete("/{doc_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{doc_id}/", dependencies=[Depends(require_role("admin"))])
def api_delete_reference_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    # If it's a file-backed doc, remove the underlying file
    try:
        import json as _json
        from pathlib import Path

        from backend.config.settings import get_settings

        content = _json.loads(doc.content) if doc.content else {}
        file_url = content.get("file_url") if isinstance(content, dict) else None
        if file_url:
            name = file_url.rsplit("/", 1)[-1]
            # Try R2 first, then local
            try:
                from backend.services.upload_service import _r2_client
                r2 = _r2_client()
            except Exception:
                r2 = None
            bucket = getattr(get_settings(), "r2_bucket_resolved", None) or getattr(get_settings(), "r2_bucket", None) or getattr(get_settings(), "r2_bucket_name", None)
            deleted = False
            if r2 is not None and bucket:
                try:
                    r2.delete_object(Bucket=bucket, Key=f"documents/{name}")
                    deleted = True
                except Exception:
                    pass
            if not deleted:
                p = Path(get_settings().storage_root) / "documents" / name
                if p.exists():
                    p.unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(doc)
    db.commit()
    cache_invalidate("reference_docs:")
    return {"ok": True, "deleted": doc_id}
def api_toggle_visibility(
    doc_id: str,
    body: _VisibilityPayload,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    doc.visible_to_students = body.visible_to_students
    db.commit()
    cache_invalidate("reference_docs:")
    return {"ok": True, "visible_to_students": doc.visible_to_students}


@router.get("/admin/list")
@router.get("/admin/list/")
def api_admin_list_reference_docs(
    doc_type: str | None = Query(default=None),
    subject_slug: str | None = Query(default=None),
    form_level: int | None = Query(default=None),
    query: str | None = Query(default=None),
    visible_only: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    from backend.models.reference_doc import ReferenceDoc

    q = db.query(ReferenceDoc)
    if doc_type in _VALID_TYPES:
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    if subject_slug:
        q = q.filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
    if visible_only is True:
        q = q.filter(ReferenceDoc.visible_to_students == True)  # noqa: E712
    if query:
        from sqlalchemy import or_
        like = f"%{query}%"
        q = q.filter(or_(
            ReferenceDoc.title.ilike(like),
            ReferenceDoc.subject_name.ilike(like),
        ))
    total = q.count()
    items = q.order_by(
        ReferenceDoc.doc_type.asc(),
        ReferenceDoc.form_level.asc(),
        ReferenceDoc.title.asc(),
    ).offset(offset).limit(limit).all()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [serialize_doc(d) for d in items],
    }


@router.post("/admin/set-all-visibility")
@router.post("/admin/set-all-visibility/")
def api_admin_set_all_visibility(
    body: _VisibilityPayload,
    doc_type: str | None = Query(default=None),
    subject_slug: str | None = Query(default=None),
    form_level: int | None = Query(default=None),
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    from backend.models.reference_doc import ReferenceDoc

    q = db.query(ReferenceDoc)
    if doc_type in _VALID_TYPES:
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    if subject_slug:
        q = q.filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
    count = q.update({ReferenceDoc.visible_to_students: body.visible_to_students})
    db.commit()
    cache_invalidate("reference_docs:")
    return {"ok": True, "updated": count}
