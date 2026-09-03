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

import json
import os
import re
from collections import OrderedDict
from pathlib import Path

# Official NECTA subject codes (authoritative; never overridden by KB JSON).
OFFICIAL_NECTA_CODE = {
    "mathematics": "021",
    "english": "011",
    "kiswahili": "012",
    "physics": "031",
    "chemistry": "032",
    "biology": "033",
}

# knowledge-base JSON file name per casuya slug for O-Level.
KB_OLEVEL_FILE = {
    "mathematics": "mathematics_olevel.json",
    "english": "english_olevel.json",
    "kiswahili": "kiswahili_olevel.json",
    "physics": "physics_f1_f4.json",
    "chemistry": "chemistry_olevel.json",
    "biology": "biology_olevel.json",
}


# Common OCR artifacts seen in the parsed TIE PDFs (double letters, stray dots).
_OCR_FIXES = [
    (re.compile(r"(?i)\bifrst\b"), "first"),
    (re.compile(r"(?i)\bscientiifc\b"), "scientific"),
    (re.compile(r"(?i)\bbasicc\b"), "basic"),
    (re.compile(r"(?i)\bexplaain\b"), "explain"),
]


def _clean(text: str | None) -> str:
    """Normalise whitespace and collapse repeated/full-stop noise from OCR."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    for pat, repl in _OCR_FIXES:
        text = pat.sub(repl, text)
    return text


def _dedupe_active_verb(text: str) -> str:
    """Collapse accidental doubled leading verbs (e.g. 'Use Use ...')."""
    parts = text.split()
    if len(parts) >= 2 and parts[0].lower() == parts[1].lower():
        del parts[0]
    return " ".join(parts)


def load_kb_o_level(kb_root: str, slug: str) -> dict | None:
    filename = KB_OLEVEL_FILE.get(slug)
    if not filename:
        return None
    path = Path(kb_root) / "syllabi" / "o_level" / filename
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def build_topics_from_units(units: list[dict], *, min_periods: int = 3) -> list[dict]:
    """Turn a cleaned list of (form, unit) tuples into seed topics.

    Each unit becomes a topic; each competence becomes a subtopic; each lesson
    becomes an outcome. Numbering resets per form (topic X.0, subtopic X.Y).
    """
    by_form: dict[int, list[dict]] = OrderedDict()
    for u in units:
        by_form.setdefault(u["form"], []).append(u)

    topics: list[dict] = []
    for form, form_units in by_form.items():
        for ui, u in enumerate(form_units, start=1):
            topic_title = _clean(u["unit_title"])
            subtopics: list[dict] = []
            for si, comp in enumerate(u["competences"], start=1):
                outcome_texts = []
                for lesson in comp["lessons"]:
                    txt = _dedupe_active_verb(_clean(lesson))
                    if txt:
                        outcome_texts.append(txt)
                if not outcome_texts:
                    continue
                outcomes = [
                    (txt, "comprehension", oi)
                    for oi, txt in enumerate(outcome_texts, start=1)
                ]
                subtopics.append({
                    "title": _clean(comp["title"]),
                    "code": f"{ui}.{si}",
                    "order": si,
                    "periods": 0,
                    "outcomes": outcomes,
                })
            if not subtopics:
                # Keep the unit as a topic even if competences were empty but fold
                # nothing; still emit it with a single placeholder subtopic.
                subtopics.append({
                    "title": topic_title,
                    "code": f"{ui}.1",
                    "order": 1,
                    "periods": 0,
                    "outcomes": [],
                })
            topics.append({
                "title": topic_title,
                "code": f"{ui}.0",
                "form_level": form,
                "order": ui,
                "periods": 0,
                "weight": "medium",
                "subtopics": subtopics,
            })
    return topics


def distribute_periods(topics: list[dict], form_totals: dict[int, int]) -> None:
    """Allocate each form's total periods across its topics proportionally to the
    number of subtopics (competences), preserving the original per-form total."""
    by_form: dict[int, list[dict]] = OrderedDict()
    for t in topics:
        by_form.setdefault(t["form_level"], []).append(t)

    for form, form_topics in by_form.items():
        total = form_totals.get(form, 0)
        n_sub = sum(len(t["subtopics"]) for t in form_topics)
        for t in form_topics:
            share = len(t["subtopics"])
            periods = round(total * share / n_sub) if (total and n_sub) else 0
            t["periods"] = periods
            t["weight"] = ("high" if periods >= 12 else
                           "medium" if periods >= 6 else "low")
            if t["subtopics"]:
                base = periods // len(t["subtopics"])
                for i, sp in enumerate(t["subtopics"]):
                    sp["periods"] = base + (1 if i < periods % len(t["subtopics"]) else 0)
            else:
                t["periods"] = periods


def merge_olevel(preserved_o_level: list[dict] | None, new_o_level: list[dict]) -> list[dict]:
    """Combine regenerated O-Level topics with untouched A-Level topics.

    preserved_o_level contains the existing seed's A-Level (Form 5-6) topics.
    """
    alevel = [t for t in (preserved_o_level or []) if t["form_level"] >= 5]
    return new_o_level + alevel


def regenerate_subject(
    kb_root: str,
    slug: str,
    existing_subject: dict,
    *,
    form_totals: dict[int, int] | None = None,
    unit_forms: dict[str, int] | None = None,
    o_level_forms: tuple[int, ...] = (1, 2, 3, 4),
) -> dict | None:
    """Regenerate the O-Level portion of a subject for given KB units.

    kb_root        : root of the knowledge-base folder.
    slug           : casuya subject slug (e.g. "physics").
    existing_subject: the current seed's full subject dict (top-level metadata is
                     preserved; A-Level topics are kept; O-Level topics rebuilt).
    form_totals    : explicit per-form O-Level period totals; if None these are
                     derived from the existing seed's O-Level topics.
    unit_forms     : explicit map of unit_title -> form for subjects whose KB
                     JSON does not carry reliable per-unit forms.
    o_level_forms  : which form levels the KB JSON covers (replaced from KB).
    """
    data = load_kb_o_level(kb_root, slug)
    if not data:
        return None

    # 1. Clean + dedupe units. KB JSON has duplicated units; collapse identical
    #    unit (form, title, competences) into one, merging lesson sets.
    cleaned: dict[tuple, dict] = OrderedDict()
    for unit in data["units"]:
        form = unit.get("form")
        title = _clean(unit.get("unit_title"))
        competences = []
        seen: set[str] = set()
        for comp in unit.get("topics", []):
            c_title = _clean(comp.get("topic_name"))
            if not c_title or c_title.lower() in seen:
                continue
            seen.add(c_title.lower())
            lessons = [
                _clean(l.get("title") or l.get("markdown_content"))
                for l in comp.get("lessons", [])
            ]
            lessons = OrderedDict.fromkeys([x for x in lessons if x]).keys()
            competences.append({"title": c_title, "lessons": list(lessons)})
        if not competences:
            continue
        if unit_forms and title in unit_forms:
            form = unit_forms[title]
        key = (form, title)
        if key in cleaned:
            # merge competences + lessons
            cleaned[key]["competences"].extend(competences)
        else:
            cleaned[key] = {"form": form, "unit_title": title, "competences": competences}
    clean_units = list(cleaned.values())

    # 2. Build O-Level topics.
    new_o_level = build_topics_from_units(clean_units)

    # 3. Periods: use provided totals or derive per-form totals from existing seed.
    existing_topics = existing_subject.get("topics", [])
    if form_totals is None:
        form_totals = {}
        for t in existing_topics:
            if t["form_level"] <= 4:
                form_totals[t["form_level"]] = form_totals.get(t["form_level"], 0) + (t.get("periods") or 0)
    distribute_periods(new_o_level, form_totals)

    # 4. Merge with preserved A-Level.
    topics = merge_olevel(existing_topics, new_o_level)

    subject = dict(existing_subject)
    subject["topics"] = topics
    return subject
