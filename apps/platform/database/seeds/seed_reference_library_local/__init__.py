"""Seed the bundled (curated/local) reference library into ``reference_docs``.

The educator team verifies official TIE curriculum content (lesson plans and
schemes) and commits it under ``database/seeds/data/reference/`` as JSON.  This
module upserts every bundled document so browse/search and generation-time
grounding see the verified material without any live network access - critical
for the offline-first / 2G target.

Each bundled file follows::

    {
      "subject_name": "Physics",
      "subject_slug": "physics",
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

from ._setup import _BUNDLED_DIR, _SOURCE_PREFIX, logger
from .content import (
    _content_for,
    _scheme_content_for,
    _stable_id,
    _normalize_title,
)
from .upsert import (
    _upsert_doc,
    _purge_conflicting_online_docs,
    _deduplicate_online_docs,
)
from .run import bundled_files, run, main

__all__ = [
    "_BUNDLED_DIR",
    "_SOURCE_PREFIX",
    "logger",
    "_content_for",
    "_scheme_content_for",
    "_stable_id",
    "_normalize_title",
    "_upsert_doc",
    "_purge_conflicting_online_docs",
    "_deduplicate_online_docs",
    "bundled_files",
    "run",
    "main",
]


if __name__ == "__main__":
    main()