"""Reference library endpoints — browse and search imported official lessons/schemes.

Read-only, public access (same pattern as syllabus browsing). Documents are
imported from the public reference platform by the import script and stored in
``reference_docs``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.services.reference_library_service import (
    count_reference_docs,
    get_reference_doc,
    list_reference_docs,
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
    return {
        "lesson_plans": count_reference_docs(db, doc_type="lesson_plan"),
        "schemes_of_work": count_reference_docs(db, doc_type="scheme_of_work"),
        "total": count_reference_docs(db),
    }


@router.get("/{doc_id}")
@router.get("/{doc_id}/")
def api_get_reference_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = get_reference_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Reference document not found")
    return serialize_doc(doc)
