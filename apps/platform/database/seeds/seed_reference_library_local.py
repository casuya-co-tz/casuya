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
      "lessons": [ {plan detail dicts like the reference API, each with "title"}, ... ]
    }

Plan details use the public reference API shape (``main_competence``,
``specific_competence``, ``main_activity``, ``specific_activity``,
``teaching_learning_resources``, ``references``, ``teaching_structure`` with
per-stage ``teaching_activities``/``learning_activities``/``assessment_criteria``)
so rendering and grounding require no special-casing.

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


def run(db, *, check_existing: bool = True) -> tuple[int, int]:
    """Seed every bundled reference document.

    Returns ``(inserted, replaced)``.  A document whose ``source_id`` already
    exists but whose content/metadata changed is replaced in place.
    """
    from backend.models.reference_doc import ReferenceDoc
    from backend.services.reference_library_service import (
        get_reference_doc_by_source,
        parse_metadata,
    )

    inserted = 0
    replaced = 0
    for path in bundled_files():
        try:
            with open(path, encoding="utf-8") as fh:
                bundle = json.load(fh)
        except (OSError, ValueError):
            logger.warning("Skipping unreadable bundled reference file %s", path)
            continue
        for lesson in bundle.get("lessons") or []:
            title = lesson.get("title") or ""
            if not title:
                continue
            standard = bundle.get("standard") or lesson.get("standard") or ""
            slug, form_level, subject_name = parse_metadata(title, standard)
            content = _content_for(dict(lesson))
            source_id = f"{_SOURCE_PREFIX}{lesson.get('source_id') or _stable_id(title)}"

            existing = get_reference_doc_by_source(db, "lesson_plan", source_id) if check_existing else None
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
                if updated:
                    replaced += 1
                continue

            db.add(ReferenceDoc(
                doc_type="lesson_plan",
                source_id=source_id,
                source_url=None,
                title=title,
                subject_name=subject_name,
                subject_slug=slug,
                form_level=form_level,
                standard=standard,
                content=json.dumps(content, ensure_ascii=False),
            ))
            inserted += 1
    db.commit()
    return inserted, replaced


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
        inserted, replaced = run(db)
    finally:
        db.close()
    logger.info("DONE: inserted=%d replaced=%d", inserted, replaced)


if __name__ == "__main__":
    main()