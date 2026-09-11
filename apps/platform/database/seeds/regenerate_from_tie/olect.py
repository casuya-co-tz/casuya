"""KB loading + whole-subject orchestration for the TIE regenerator.

``load_kb_o_level`` returns the raw parsed JSON; ``enrich_subject`` injects
authentic KB lessons into an existing per-form skeleton (rich-KB subjects);
``regenerate_subject`` rebuilds the O-Level topics from unit -> competence ->
lesson content (full-KB subjects), preserving A-Level topics and period totals.
"""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

from .maps import (
    MATHS_TOPIC_MAP,
    CHEMISTRY_TOPIC_MAP,
    KB_OLEVEL_FILE,
)
from .text import _clean
from .transform import (
    enrich_olevel_topics,
    build_topics_from_units,
    distribute_periods,
    merge_olevel,
)


def load_kb_o_level(kb_root: str, slug: str) -> dict | None:
    filename = KB_OLEVEL_FILE.get(slug)
    if not filename:
        return None
    path = Path(kb_root) / "syllabi" / "o_level" / filename
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def enrich_subject(kb_root: str, slug: str, existing_subject: dict) -> dict | None:
    """Enrich an O-Level per-form skeleton with authentic KB lessons.

    Preserves all existing topics, subtopics, outcomes, period totals, codes and
    A-Level topics; appends the KB competence lessons into matching topics.
    """
    comp_map = {
        "mathematics": MATHS_TOPIC_MAP,
        "chemistry": CHEMISTRY_TOPIC_MAP,
    }.get(slug)
    if comp_map is None:
        return None
    data = load_kb_o_level(kb_root, slug)
    if not data:
        return None
    topics = existing_subject.get("topics", [])
    enriched, assigned, unmatched = enrich_olevel_topics(topics, data["units"], comp_map)
    subject = dict(existing_subject)
    subject["topics"] = enriched
    # Recompute subtopic order indexes after injection.
    for t in subject["topics"]:
        if t["form_level"] <= 4:
            for sp in t.get("subtopics", []):
                sp["order"] = sp.get("order") or 0
    return {
        "subject": subject,
        "assigned": assigned,
        "unmatched": unmatched,
    }


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