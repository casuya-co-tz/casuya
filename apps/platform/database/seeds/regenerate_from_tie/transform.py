"""Syllabus transformation helpers for the TIE O-Level regenerator.

Turns cleaned KB units into seed topics and injects KB lessons into an
existing per-form skeleton (round-robin across matching subtopics).
"""

from __future__ import annotations

from collections import OrderedDict

from .text import _clean, _dedupe_active_verb


def enrich_olevel_topics(topics: list[dict], units: list[dict], comp_map: dict) -> tuple[list[dict], list, list]:
    """Inject authentic KB lessons into a per-form skeleton, preserving structure.

    Keeps every existing topic/subtopic/outcome and appends each competence's
    distinct lessons (deduped against existing outcome text and within the KB)
    round-robin across the target topic's subtopics. Returns
    (enriched_topics, assigned_lessons, unmatched_entries).
    """
    # Index target topics by lowercased title (only O-Level; A-Level untouched).
    by_title: dict[str, list[dict]] = {}
    order: dict[str, int] = {}
    for t in topics:
        if t["form_level"] <= 4 and t.get("title"):
            by_title.setdefault(t["title"].lower(), []).append(t)
            order.setdefault(t["title"].lower(), len(order))

    # Collect distinct cleaned lessons per competence and match to a target topic.
    assigned = []
    unmatched = []
    for unit in units:
        for comp in unit.get("topics", []):
            c_title = _clean(comp.get("topic_name"))
            if not c_title or c_title not in comp_map:
                unmatched.append(c_title)
                continue
            target = comp_map[c_title].lower()
            targets = by_title.get(target)
            if not targets:
                unmatched.append(f"{c_title} -> {comp_map[c_title]}")
                continue
            lessons = []
            for l in comp.get("lessons", []):
                txt = _dedupe_active_verb(_clean(l.get("title") or l.get("markdown_content")))
                if txt:
                    lessons.append(txt)
            lessons = list(OrderedDict.fromkeys(lessons))

            # Distribute round-robin across the target topic's subtopics.
            for sp_idx, tgt in enumerate(targets):
                subs = tgt.get("subtopics", [])
                if not subs:
                    continue
                existing = {o[0] for sp in subs for o in sp.get("outcomes", [])
                            if isinstance(o, dict) and o.get("description")}
                # Also track tuple-outcome descriptions.
                for sp in subs:
                    for o in sp.get("outcomes", []):
                        if isinstance(o, (list, tuple)) and o:
                            existing.add(o[0])
                slot = 0
                for lesson in lessons:
                    if lesson in existing:
                        continue
                    sp = subs[slot % len(subs)]
                    sp.setdefault("outcomes", []).append((lesson, "comprehension", 0))
                    existing.add(lesson)
                    assigned.append(lesson)
                    slot += 1

    return topics, assigned, unmatched


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