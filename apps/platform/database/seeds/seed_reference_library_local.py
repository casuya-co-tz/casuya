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


def run(db, *, check_existing: bool = True) -> tuple[int, int, int, int]:
    """Seed every bundled reference document (lessons and schemes).

    Returns ``(inserted_lessons, replaced_lessons, inserted_schemes,
    replaced_schemes)`` so callers can report how much new material each run
    brought in.
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
    db.commit()
    return inserted, replaced, inserted_schemes, replaced_schemes


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
        inserted, replaced, inserted_schemes, replaced_schemes = run(db)
    finally:
        db.close()
    logger.info(
        "DONE: lessons inserted=%d replaced=%d schemes inserted=%d replaced=%d",
        inserted, replaced, inserted_schemes, replaced_schemes,
    )


if __name__ == "__main__":
    main()