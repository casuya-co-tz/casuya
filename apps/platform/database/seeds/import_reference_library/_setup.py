"""Setup + configuration constants for the reference-library importer."""

from __future__ import annotations

import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("import_reference_library")

DEFAULT_API = "https://api.clickonlineacademy.ac.tz/v1"
DEFAULT_TOKEN = "2ec26ad9-e039-445e-915e-a482dc6f5e3b"

DEFAULT_CACHE_DIR = str(
    Path(__file__).resolve().parent.parent.parent.parent / "data" / "reference_library_cache"
)

CATALOGS = {
    "lesson_plan": ("/lesson_plan/get-all-lesson-plan", "/lesson_plan/get-lesson-plan-by-plan-id/{id}"),
    "scheme_of_work": ("/scheme_of_work/get-all-scheme-of-work", "/scheme_of_work/get-scheme-of-work-by-scheme-of-work-id/{id}"),
}

_KIND_ALIASES = {"lesson_plan": "lesson plan", "scheme_of_work": "scheme of work"}