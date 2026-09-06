"""Seed the bundled (curated/local) reference library into ``reference_docs``.

The educator team verifies official TIE curriculum content (lesson plans and
schemes) and commits it under ``database/seeds/data/reference/`` as JSON.  This
module upserts every bundled document so browse/search and generation-time
grounding see the verified material without any live network access - critical
for the offline-first / 2G target.

Each bundled file follows::

    {
      "subject_name": "Geography",
      "subject_slug": "geography",
      "form_level": 1,
      "standard": "Form 1",
      "lessons": [ {plan detail dicts like the reference API, each with "title"}, ... ],
      "schemes":  [ {scheme-of-work bundles, each with "title" and
                     "scheme_of_work_details" rows}, ... ]
    }

Plan details use the public reference API shape (``main_competence``,
``specific_competence``, ``main_activity``, ``specific_activity``,
``teaching_learning_resources``, ``references``, ``teaching_structure`` with
per-stage ``teaching_activities``/``learning_activities``/``assessment_criteria``)
so rendering and grounding require no special-casing. Scheme rows use the
reference API column keys ``one``..``twelve`` (optionally an extra ``topic``
key carrying the teaching-topic header each row belongs to).

Idempotent: a document already imported (same ``source_id``, unchanged content)
is skipped. Safe to re-run against local and production.

Usage (from the repo -- database module is importable as ``database.seeds``):

    python -m database.seeds.seed_reference_library_local
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_reference_library_local")

_BUNDLED_DIR = Path(__file__).resolve().parent / "data" / "reference"

# ``source_id`` prefix so bundled docs never collide with API-imported rows
# (which use plain numeric ids) and can be dropped wholesale if ever needed.
_SOURCE_PREFIX = "bundled:"


def bundled_files() -> list[Path]:
    """Return the bundled reference-library JSON files, ordered by name."""
    if not _BUNDLED_DIR.is_dir():
        return []
    return sorted(_BUNDLED_DIR.glob("*.json"))


def _content_for(lesson: dict) -> dict:
    """Wrap one plan detail into the reference content payload shape."""
    return {
        "title": lesson.get("title") or "",
        "standard": lesson.pop("standard", "") or "",
        "plan_details": [lesson],
    }


def _scheme_content_for(scheme: dict) -> dict:
    """Wrap one scheme-of-work bundle into the reference content payload shape."""
    return {
        "title": scheme.get("title") or "",
        "standard": scheme.get("standard") or "",
        "term": scheme.get("term"),
        "scheme_of_work_details": list(scheme.get("scheme_of_work_details") or []),
    }


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


def _normalize_title(title: str) -> str:
    """Collapse a title to a canonical form for deduplication.

    Strips punctuation, normalises whitespace and removes common cosmetic
    differences (e.g. ``FORM ONE 2026`` vs ``FORM ONE-2026``) so two titles
    that refer to the same lesson/scheme are considered equal.
    """
    import re as _re

    t = (title or "").lower()
    # Remove punctuation except alphanumerics and spaces
    t = _re.sub(r"[^a-z0-9\s]", " ", t)
    # Collapse whitespace
    t = " ".join(t.split())
    return t.strip()


def _deduplicate_online_docs(db) -> int:
    """Remove online-catalog duplicates that share a normalised title.

    Even when no bundled docs exist yet (e.g. the bundled seed failed
    silently), near-identical online imports like
    ``LESSON PLAN FOR GEOGRAPHY FORM ONE 2026`` and
    ``LESSON PLAN FOR GEOGRAPHY FORM ONE-2026`` should collapse to the
    latest record (highest ``source_id``).  Returns the number of rows
    removed.
    """
    from collections import defaultdict

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
    ))
    return 1, True


def run(db, *, check_existing: bool = True) -> tuple[int, int, int, int, int]:
    """Seed every bundled reference document (lessons and schemes).

    Returns ``(inserted_lessons, replaced_lessons, inserted_schemes,
    replaced_schemes, purged_online)`` so callers can report how much new
    material each run brought in. ``purged_online`` counts online-catalog
    duplicates removed because a verified bundle now owns that
    subject/form/type slot.
    """
    from backend.services.reference_library_service import parse_metadata

    inserted = 0
    replaced = 0
    inserted_schemes = 0
    replaced_schemes = 0
    for path in bundled_files():
        try:
            with open(path, encoding="utf-8") as fh:
                bundle = json.load(fh)
        except (OSError, ValueError):
            logger.warning("Skipping unreadable bundled reference file %s", path)
            continue
        bundle_standard = bundle.get("standard") or ""
        for lesson in bundle.get("lessons") or []:
            title = lesson.get("title") or ""
            if not title:
                continue
            standard = bundle_standard or lesson.get("standard") or ""
            slug, form_level, subject_name = parse_metadata(title, standard)
            source_id = lesson.get("source_id") or _stable_id(title)
            created, is_new = _upsert_doc(
                db, "lesson_plan", source_id, title, standard,
                subject_name, slug, form_level,
                _content_for(dict(lesson)), check_existing,
            )
            if not created:
                continue
            if is_new:
                inserted += 1
            else:
                replaced += 1
        for scheme in bundle.get("schemes") or []:
            title = scheme.get("title") or ""
            if not title:
                continue
            standard = scheme.get("standard") or bundle_standard or ""
            slug, form_level, subject_name = parse_metadata(title, standard)
            source_id = scheme.get("source_id") or _stable_id(title)
            created, is_new = _upsert_doc(
                db, "scheme_of_work", source_id, title, standard,
                subject_name, slug, form_level,
                _scheme_content_for(scheme), check_existing,
            )
            if not created:
                continue
            if is_new:
                inserted_schemes += 1
            else:
                replaced_schemes += 1

    # Keep ONE clean, authoritative source per subject/form/type: every slot
    # covered by a verified bundle gets its online-catalog duplicates removed.
    # Derived from the database so re-runs clean up even untouched deployments.
    # Flush first: sessions with autoflush=False must see this run's inserts.
    from backend.models.reference_doc import ReferenceDoc

    db.flush()
    purged = 0
    slots = (
        db.query(ReferenceDoc.doc_type, ReferenceDoc.subject_slug, ReferenceDoc.form_level)
        .filter(ReferenceDoc.source_id.like(f"{_SOURCE_PREFIX}%"))
        .distinct()
        .all()
    )
    for doc_type, slug, form_level in slots:
        purged += _purge_conflicting_online_docs(db, doc_type, slug or None, form_level or 0)

    # Flush the bundle-aware deletes so the title-dedup query below doesn't
    # re-count docs already marked for deletion (critical when autoflush is off).
    db.flush()

    # Also deduplicate online docs that share a normalised title (e.g.
    # ``FORM ONE 2026`` vs ``FORM ONE-2026``) even when no bundled docs
    # exist for that slot — catches the common catalog-duplicate case.
    purged += _deduplicate_online_docs(db)

    db.commit()
    return inserted, replaced, inserted_schemes, replaced_schemes, purged


def _stable_id(title: str) -> str:
    """Derive a stable per-lesson id from its title (e.g. a lesson number)."""
    import re

    cleaned = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")
    return cleaned or "lesson"


def main() -> None:
    from backend.config.database import get_db, init_db

    init_db()
    db = next(get_db())
    try:
        inserted, replaced, inserted_schemes, replaced_schemes, purged = run(db)
    finally:
        db.close()
    logger.info(
        "DONE: lessons inserted=%d replaced=%d schemes inserted=%d replaced=%d "
        "online duplicates purged=%d",
        inserted, replaced, inserted_schemes, replaced_schemes, purged,
    )


if __name__ == "__main__":
    main()