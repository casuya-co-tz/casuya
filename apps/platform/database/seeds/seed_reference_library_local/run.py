"""Seed orchestration for the bundled reference library: ``run`` + ``main``."""

from __future__ import annotations

import json
from pathlib import Path

from ._setup import _BUNDLED_DIR, _SOURCE_PREFIX, logger
from .content import _content_for, _scheme_content_for, _stable_id
from .upsert import _upsert_doc, _purge_conflicting_online_docs, _deduplicate_online_docs


def bundled_files() -> list[Path]:
    """Return the bundled reference-library JSON files, ordered by name."""
    if not _BUNDLED_DIR.is_dir():
        return []
    return sorted(_BUNDLED_DIR.glob("*.json"))


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