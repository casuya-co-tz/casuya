"""Import the public reference library (official lessons + schemes) from the
reference platform (clickonlineacademy.ac.tz) into ``reference_docs``.

Extracts the FULL catalog — every lesson plan and scheme of work — and stores
each document's complete detail payload (competences, activities, per-stage
teaching structures, assessment criteria, etc.) so teachers can browse/search
them as grounding references when generating their own plans.

Usage (from apps/platform):

    python -m database.seeds.import_reference_library                # full import
    python -m database.seeds.import_reference_library --limit 5      # pilot
    python -m database.seeds.import_reference_library --cache-dir ... # custom cache

Configuration (environment):
    REFERENCE_API_BASE   default https://api.clickonlineacademy.ac.tz/v1
    REFERENCE_AUTH_TOKEN default 2ec26ad9-... (embedded public app token)

The script is idempotent and resumable: a document already imported (or already
cached) is skipped. Raw detail payloads are cached under ``cache_dir`` so a run
can be re-played offline without re-hitting the network.
"""

from __future__ import annotations

from ._setup import logger, DEFAULT_API, DEFAULT_TOKEN, DEFAULT_CACHE_DIR, CATALOGS, _KIND_ALIASES
from .workers import (
    _fetch,
    _upsert_doc,
    _parse_lesson,
    _parse_scheme,
    _cache_ids,
    _ellipsis,
    _import_document,
)
from .run import run, main

__all__ = [
    "logger",
    "DEFAULT_API",
    "DEFAULT_TOKEN",
    "DEFAULT_CACHE_DIR",
    "CATALOGS",
    "_KIND_ALIASES",
    "_fetch",
    "_upsert_doc",
    "_parse_lesson",
    "_parse_scheme",
    "_cache_ids",
    "_ellipsis",
    "_import_document",
    "run",
    "main",
]


if __name__ == "__main__":
    main()