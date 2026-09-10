"""Regenerate O-Level (Form 1-4) syllabus content from the authoritative TIE
knowledge-base JSON files parsed from the official TIE PDFs.

Strategy (hybrid):
- For subjects where the knowledge-base JSON is rich and complete (Physics,
  English, Kiswahili), rebuild the O-Level topics/subtopics/outcomes from the
  real TIE lesson content (unit -> competence -> lesson), preserving the
  official NECTA code and the per-form estimated-period totals already present
  in the current seed (the knowledge-base JSON carries no period data).
- A-Level (Form 5-6) topics are left untouched.
- Official NECTA codes are never taken from the knowledge-base (its codes are
  unreliable); they are preserved from the current seed.

Transformation:
  knowledge-base "unit"         -> seed "topic"   (broad competence theme)
  knowledge-base "topic"(comp.) -> seed "subtopic" (numbered competence)
  knowledge-base "lesson"       -> seed "outcome"  (specific learning objective)

The knowledge-base is messy (duplicated units, OCR noise, unreliable "form" and
"subject_code" metadata). This tool cleans/dedupes and maps forms explicitly.
"""

from __future__ import annotations

from .maps import (
    ENGLISH_TOPIC_MAP,
    KISWAHILI_TOPIC_MAP,
    MATHS_TOPIC_MAP,
    CHEMISTRY_TOPIC_MAP,
    BIOLOGY_TOPIC_MAP,
    OFFICIAL_NECTA_CODE,
    KB_OLEVEL_FILE,
)
from .text import _OCR_FIXES, _clean, _dedupe_active_verb
from .transform import (
    enrich_olevel_topics,
    build_topics_from_units,
    distribute_periods,
    merge_olevel,
)
from .olect import (
    load_kb_o_level,
    enrich_subject,
    regenerate_subject,
)

__all__ = [
    "ENGLISH_TOPIC_MAP",
    "KISWAHILI_TOPIC_MAP",
    "MATHS_TOPIC_MAP",
    "CHEMISTRY_TOPIC_MAP",
    "BIOLOGY_TOPIC_MAP",
    "OFFICIAL_NECTA_CODE",
    "KB_OLEVEL_FILE",
    "_OCR_FIXES",
    "_clean",
    "_dedupe_active_verb",
    "enrich_olevel_topics",
    "build_topics_from_units",
    "distribute_periods",
    "merge_olevel",
    "load_kb_o_level",
    "enrich_subject",
    "regenerate_subject",
]