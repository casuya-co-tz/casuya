"""Row-level upsert + online-catalog conflict/dedup cleanup for the bundled
reference-library seeder.
"""

from __future__ import annotations

import json
from collections import defaultdict

from .content import _normalize_title
from ._setup import _SOURCE_PREFIX


def _upsert_doc(db, doc_type: str, source_raw: str, title: str, standard: str,
                subject_name: str, slug, form_level: int, content: dict,
                check_existing: bool) -> tuple[int, bool]:
    """Insert or (when changed) replace one bundled reference document.

    Returns ``(1, created)`` where ``created`` is True for an insert and False
    for an in-place content replacement. A pre-existing, unchanged document
    contributes ``(0, False)``.
    """
    from backend.models.reference_doc import ReferenceDoc
    from backend.services.reference_library_service import get_reference_doc_by_source

    if not title:
        return 0, False
    source_id = f"{_SOURCE_PREFIX}{source_raw}"
    existing = get_reference_doc_by_source(db, doc_type, source_id) if check_existing else None
    if existing is not None:
        updated = False
        if existing.content != json.dumps(content, ensure_ascii=False):
            existing.content = json.dumps(content, ensure_ascii=False)
            updated = True
        for key, value in (
            ("title", title),
            ("subject_name", subject_name),
            ("subject_slug", slug),
            ("form_level", form_level),
            ("standard", standard),
        ):
            if getattr(existing, key) != value:
                setattr(existing, key, value)
                updated = True
        if not existing.visible_to_students:
            existing.visible_to_students = True
            updated = True
        return (1, False) if updated else (0, False)

    db.add(ReferenceDoc(
        doc_type=doc_type,
        source_id=source_id,
        source_url=None,
        title=title,
        subject_name=subject_name,
        subject_slug=slug,
        form_level=form_level,
        standard=standard,
        content=json.dumps(content, ensure_ascii=False),
        visible_to_students=True,
    ))
    return 1, True


def _purge_conflicting_online_docs(db, doc_type: str, slug: str | None,
                                   form_level: int) -> int:
    """Drop non-bundled reference docs that duplicate a verified bundle.

    Once an educator-verified ``bundled:`` document exists for a
    (doc_type, subject, form), it is the single authoritative record: any
    online-catalog copies that crept in for the same slot are deleted so the
    library speaks one language (Geography Form One's noisy online schemes and
    duplicate lesson plans are the motivating case). Returns the number of
    rows removed; a no-op for subject/form/type pairs without a bundle.
    """
    if not slug or not form_level:
        return 0
    from backend.models.reference_doc import ReferenceDoc

    has_bundle = (
        db.query(ReferenceDoc)
        .filter(
            ReferenceDoc.doc_type == doc_type,
            ReferenceDoc.subject_slug == slug,
            ReferenceDoc.form_level == form_level,
            ReferenceDoc.source_id.like(f"{_SOURCE_PREFIX}%"),
        )
        .first()
    )
    if has_bundle is None:
        return 0
    offenders = (
        db.query(ReferenceDoc)
        .filter(
            ReferenceDoc.doc_type == doc_type,
            ReferenceDoc.subject_slug == slug,
            ReferenceDoc.form_level == form_level,
            ReferenceDoc.source_id.notlike(f"{_SOURCE_PREFIX}%"),
        )
        .all()
    )
    for doc in offenders:
        db.delete(doc)
    return len(offenders)


def _deduplicate_online_docs(db) -> int:
    """Remove online-catalog duplicates that share a normalised title.

    Even when no bundled docs exist yet (e.g. the bundled seed failed
    silently), near-identical online imports like
    ``LESSON PLAN FOR GEOGRAPHY FORM ONE 2026`` and
    ``LESSON PLAN FOR GEOGRAPHY FORM ONE-2026`` should collapse to the
    latest record (highest ``source_id``).  Returns the number of rows
    removed.
    """
    from backend.models.reference_doc import ReferenceDoc

    # Group non-bundled docs by (doc_type, subject_slug, form_level, normalised_title)
    groups: dict[tuple, list[ReferenceDoc]] = defaultdict(list)
    online_docs = (
        db.query(ReferenceDoc)
        .filter(ReferenceDoc.source_id.notlike(f"{_SOURCE_PREFIX}%"))
        .all()
    )
    for doc in online_docs:
        norm = _normalize_title(doc.title or "")
        if not norm:
            continue
        key = (doc.doc_type, doc.subject_slug, doc.form_level, norm)
        groups[key].append(doc)

    purged = 0
    for key, docs in groups.items():
        if len(docs) <= 1:
            continue
        # Keep the doc with the highest source_id (latest import), delete the rest
        docs.sort(key=lambda d: int(d.source_id) if (d.source_id or "").isdigit() else -1)
        for doc in docs[:-1]:
            db.delete(doc)
            purged += 1
    return purged