"""Full TIE CBC (2023) Lower-Secondary syllabus dataset.

This module loads the per-subject JSON datasets extracted verbatim from the
official TIE syllabus PDFs (tie.go.tz, "Syllabus for Lower Secondary
Academics"). For each subject, for each form, it exposes every Specific
Competence together with all seven detail columns:

    main competence, specific competence, learning activities,
    suggested teaching and learning methods, assessment criteria,
    suggested resources, number of periods.

Structure (per subject JSON):
    {"subject": str, "language": "en"|"sw",
     "forms": {"1": {"specific_competences": [ ... ]}, ...}}

Each specific-competence record:
    {"main_code", "main_competence", "specific_code", "specific_competence",
     "number_of_periods",
     "learning_activities": [str], "teaching_methods": [str],
     "assessment_criteria": [str], "resources": [str]}

Note: "Civics and Moral Education" is not a separate TIE academic syllabus; it
is covered by the "Historia ya Tanzania na Maadili" (history_civics) syllabus,
which is in Kiswahili.
"""

import json
from pathlib import Path
from typing import Any, Optional

_DATA_DIR = Path(__file__).resolve().parent / "tie_syllabus"

SUBJECT_SLUG_FILES = {
    "mathematics": "mathematics.json",
    "additional_mathematics": "additional_mathematics.json",
    "english": "english.json",
    "kiswahili": "kiswahili.json",
    "history": "history.json",
    "history_civics": "history_civics.json",
    "geography": "geography.json",
    "biology": "biology.json",
    "chemistry": "chemistry.json",
    "physics": "physics.json",
    "computer_science": "computer_science.json",
    "business_studies": "business_studies.json",
    "bookkeeping": "bookkeeping.json",
    "agriculture": "agriculture.json",
    "bible_knowledge": "bible_knowledge.json",
}

ALIASES = {
    "basic_mathematics": "mathematics",
    "math": "mathematics",
    "civics": "history_civics",
    "moral_education": "history_civics",
    "commerce": "business_studies",
    "book_keeping": "bookkeeping",
}

_cache: dict[str, Any] = {}


def _canonical_slug(subject_slug: str) -> Optional[str]:
    slug = (subject_slug or "").strip().lower()
    slug = slug.replace("-", "_").replace(" ", "_")
    if slug in SUBJECT_SLUG_FILES:
        return slug
    return ALIASES.get(slug)


def get_subject(subject_slug: str) -> Optional[dict]:
    """Return the parsed subject dataset, or None if unknown."""
    slug = _canonical_slug(subject_slug)
    if not slug:
        return None
    if slug in _cache:
        return _cache[slug]
    path = _DATA_DIR / SUBJECT_SLUG_FILES[slug]
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    _cache[slug] = doc
    return doc


def get_specific_competences(subject_slug: str, form_level: int) -> list[dict]:
    """Return the list of specific-competence records for a subject + form."""
    doc = get_subject(subject_slug)
    if not doc:
        return []
    return doc.get("forms", {}).get(str(form_level), {}).get(
        "specific_competences", []
    )


def list_forms(subject_slug: str) -> list[str]:
    doc = get_subject(subject_slug)
    if not doc:
        return []
    return sorted(doc.get("forms", {}).keys(), key=int)


def lookup_competence(subject_slug: str, form_level: int,
                      specific_text: str) -> Optional[dict]:
    """Return the specific-competence record whose competence text matches.

    Matching is case-insensitive and accepts a substring.
    """
    needle = (specific_text or "").strip().lower()
    if not needle:
        return None
    for rec in get_specific_competences(subject_slug, form_level):
        if needle in rec.get("specific_competence", "").lower() or \
           needle in rec.get("main_competence", "").lower():
            return rec
    return None


def find_by_keyword(subject_slug: str, form_level: int,
                    keyword: str) -> Optional[dict]:
    """Best-effort match of a teaching topic keyword to a specific competence.

    Searches the specific-competence text and, failing that, the learning
    activities + assessment criteria for the keyword (case-insensitive).
    """
    kw = (keyword or "").strip().lower()
    if not kw:
        return None
    recs = get_specific_competences(subject_slug, form_level)
    # Exact/substring match on competence text first
    for rec in recs:
        if kw in rec.get("specific_competence", "").lower():
            return rec
    # Token overlap across activities + criteria
    words = [w for w in kw.replace("/", " ").replace(",", " ").split() if len(w) > 2]
    best = None
    best_score = 0
    for rec in recs:
        haystack = " ".join(
            rec.get("learning_activities", [])
            + rec.get("assessment_criteria", [])
        ).lower()
        score = sum(1 for w in words if w in haystack)
        if score > best_score:
            best_score = score
            best = rec
    return best if best_score else None
