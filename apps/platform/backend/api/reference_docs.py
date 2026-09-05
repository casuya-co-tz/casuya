"""Reference library endpoints — browse and search imported official lessons/schemes.

Read-only, public access (same pattern as syllabus browsing). Documents are
imported from the public reference platform by the import script and stored in
``reference_docs``.  Admin-only endpoints for managing student visibility are
protected by the standard ``require_role("admin")`` dependency.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.middleware.permissions import require_role
from backend.config.database import get_db
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
    docs = list_reference_docs(
        db,
        doc_type=doc_type,
        subject_slug=subject_slug,
        form_level=form_level,
        query=query,
        limit=limit,
        offset=offset,
    )
    return {
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


@router.get("/stats")
@router.get("/stats/")
def api_reference_docs_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from backend.models.reference_doc import ReferenceDoc

    rows = (
        db.query(ReferenceDoc.doc_type, func.count(ReferenceDoc.id))
        .group_by(ReferenceDoc.doc_type)
        .all()
    )
    counts = {row[0]: row[1] for row in rows}
    return {
        "lesson_plans": counts.get("lesson_plan", 0),
        "schemes_of_work": counts.get("scheme_of_work", 0),
        "total": sum(counts.values()),
    }


@router.get("/student")
@router.get("/student/")
def api_student_reference_docs(
    doc_type: str | None = Query(default=None),
    subject_slug: str | None = Query(default=None),
    form_level: int | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Student-facing endpoint: only returns docs where visible_to_students=True."""
    from backend.models.reference_doc import ReferenceDoc

    q = db.query(ReferenceDoc).filter(ReferenceDoc.visible_to_students == True)  # noqa: E712
    if doc_type in _VALID_TYPES:
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    if subject_slug:
        q = q.filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
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


@router.get("/{doc_id}")
@router.get("/{doc_id}/")
def api_get_reference_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    return serialize_doc(doc)


@router.get("/{doc_id}/render")
@router.get("/{doc_id}/render/")
def api_render_reference_doc(doc_id: str, db: Session = Depends(get_db)):
    """Return the reference document rendered as an HTML string."""
    from fastapi.responses import HTMLResponse

    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    try:
        import json
        content = json.loads(doc.content)
    except (TypeError, ValueError):
        content = {}
    if doc.doc_type == "scheme_of_work":
        html = render_reference_scheme_html(content)
    else:
        html = render_reference_lesson_plan_html(content)
    return HTMLResponse(content=html)


# ── Admin endpoints ────────────────────────────────────────────────────


class _VisibilityPayload(BaseModel):
    visible_to_students: bool


@router.patch("/{doc_id}/visibility")
@router.patch("/{doc_id}/visibility/")
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
    return {"ok": True, "updated": count}
