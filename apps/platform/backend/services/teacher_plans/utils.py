"""Pure utility functions for teacher plan generation (no external deps beyond stdlib)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta

from .constants import KISWAHILI_SUBJECTS, _ROMAN


def _is_kiswahili(subject_slug: str) -> bool:
    return subject_slug.lower().strip() in KISWAHILI_SUBJECTS


def _lang_label(subject_slug: str) -> str:
    return "sw" if _is_kiswahili(subject_slug) else "en"


def _time_to(duration_minutes: int) -> str:
    base = datetime(2026, 1, 1, 8, 0)
    end = base + timedelta(minutes=duration_minutes)
    return end.strftime("%H:%M")


def _strip_think_tags(text: str) -> str:
    text = re.sub(r" thinking[\s\S]*?</think>", "", text).strip()
    if " thinking" in text:
        parts = text.split(" thinking")
        text = parts[-1].strip()
    return text


def _parse_plan_json(raw: str) -> dict | None:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def _is_complete_lesson_plan(plan) -> bool:
    """Accept an AI-generated lesson plan only when it has the domain structure
    the renderer needs. Anything less (e.g. a Headers-only or explanation
    payload) is rejected so the generator falls back to the offline builder."""
    if not isinstance(plan, dict):
        return False
    if not isinstance(plan.get("header"), dict):
        return False
    ca = plan.get("competence_architecture")
    if not isinstance(ca, dict) or not (ca.get("main_competence") or "").strip():
        return False
    if not (ca.get("specific_competence") or "").strip():
        return False
    return isinstance(plan.get("progression_matrix"), list) and bool(plan["progression_matrix"])


def _is_complete_scheme(plan) -> bool:
    """Accept an AI-generated scheme of work only when it carries weeks."""
    if not isinstance(plan, dict):
        return False
    if not isinstance(plan.get("header"), dict):
        return False
    return isinstance(plan.get("weeks"), list) and bool(plan["weeks"])


def _fill_lesson_plan_placeholders(
    plan: dict,
    *,
    topic_code: str,
    topic_title: str,
    sub_code: str,
    sub_title: str,
    duration_minutes: int,
) -> dict:
    """Replace leftover literal '{}' tokens (which the model sometimes copies
    verbatim from the prompt instead of substituting values) with the real
    syllabus values. Applied recursively across the whole plan so the stored
    JSON and its print HTML never leak raw placeholders like '{topic_code}'.
    """
    values = {
        "{topic_code}": topic_code or "",
        "{topic_title}": topic_title or "",
        "{subtopic_code}": sub_code or "",
        "{subtopic_title}": sub_title or "",
        "{duration}": str(duration_minutes),
        "{duration_minutes}": str(duration_minutes),
    }

    def _fill(value):
        if isinstance(value, str):
            out = value
            for k, v in values.items():
                out = out.replace(k, v)
            return out
        if isinstance(value, list):
            return [_fill(i) for i in value]
        if isinstance(value, dict):
            return {k: _fill(v) for k, v in value.items()}
        return value

    return _fill(plan)


def _as_text(value) -> str:
    """Coerce a possibly list-valued detail into a single clean string."""
    if isinstance(value, list | tuple):
        return "; ".join(str(x).strip() for x in value if str(x).strip())
    return str(value or "").strip()


def _activity_text(value):
    """Coerce an activity detail (plain string or list of strings/dicts) into a
    single readable phrase so stage tasks survive in the assessment text."""
    if isinstance(value, list | tuple):
        parts = []
        for item in value:
            if isinstance(item, dict):
                item = (item.get("description") or item.get("activity")
                        or item.get("instruction") or item.get("detail")
                        or _as_text(item))
            text = str(item or "").strip()
            if text:
                parts.append(text)
        return "; ".join(parts)
    return _as_text(value)


def _distribute_periods(activities: list[str], total: int) -> list[dict]:
    """Distribute *total* periods across *activities* as evenly as possible.

    Returns a list of ``{"activity": str, "periods": int}`` dicts whose
    period values sum to exactly *total*.  When *activities* is empty a
    single placeholder row is returned.
    """
    if not activities:
        return [{"activity": "", "periods": total}]
    n = len(activities)
    if total <= 0:
        return [{"activity": a, "periods": 0} for a in activities]
    base = total // n
    extra = total - base * n          # first *extra* activities get +1
    return [
        {"activity": a, "periods": base + (1 if i < extra else 0)}
        for i, a in enumerate(activities)
    ]


def _num(marker: int) -> str:
    return _ROMAN[marker] if 0 <= marker < len(_ROMAN) else str(marker + 1)


def _derive_specific_activities(activity_text: str) -> list[str]:
    """Break a syllabus learning activity into numbered (i)/(ii)/(iii) items.

    Prefers an explicit ``(i) (ii) ...`` list, then a trailing parenthetical
    of sub-topics, then sentence/clause boundaries, and finally a single item.
    """
    text = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", (activity_text or "").strip())
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # 1. Already a numbered (i)/(ii)/... list
    if re.search(r"\(\s*i\s*\)", text, re.I):
        parts = re.split(r"(?i)\s*\(\s*(?=[ivxlc\d]+\))", text)
        parts = [p.strip().strip(".;,() \t") for p in parts if p.strip()]
        if len(parts) >= 2:
            return parts

    # 2. Trailing parenthetical list of sub-topics
    m = re.search(r"\(([^()]*)\)\s*[.;]?\s*$", text)
    if m:
        inner = m.group(1)
        items = [s.strip() for s in re.split(r";|\u2014|,", inner) if s.strip()]
        if len(items) >= 2:
            cleaned = []
            for it in items:
                it = re.sub(r"^\s*(?:and|or|&)\s+", "", it).strip()
                it = re.sub(r"\s+(?:and|or)\s*$", "", it).strip()
                if it:
                    cleaned.append(f"({_num(len(cleaned))}) {it[:1].upper()}{it[1:]}")
            if cleaned:
                return cleaned

    # 3. Sentence / clause split
    clauses = [c for c in re.split(r"(?<=[.;:])\s+", text) if c.strip()]
    if len(clauses) >= 2:
        return [f"({_num(i)}) {c.strip().strip('.;')}".strip() for i, c in enumerate(clauses)]

    # 4. Single item
    return [f"(i) {text}"]


def _split_periods_total(total: int, n: int) -> list[int]:
    """Split a specific competence's total periods across *n* rows."""
    if n <= 0:
        return []
    if total <= 0:
        return [4] * n
    base = total // n
    extra = total - base * n
    return [base + (1 if i < extra else 0) for i in range(n)]


def _e_list_item(items, idx, default=""):
    """Return the *idx*-th item of a list, a joined string, or default."""
    if not items:
        return default
    if isinstance(items, str):
        return items if idx == 0 else default
    try:
        frac = idx / len(items)
    except ZeroDivisionError:
        return default
    if isinstance(items[0], str):
        return items[idx] if idx < len(items) else default
    return default


def _sample_book_reference(subject_label: str, form_level: int, lang: str,
                           year: str = "2024") -> str:
    if lang == "sw":
        return (f"T.I.E. ({year}). Kitabu cha Wanafunzi cha {subject_label}, "
                f"Kidato cha {form_level}. Dar es Salaam.")
    return (f"T.I.E. ({year}). {subject_label} Students Book "
            f"Form {form_level}. Dar es Salaam.")


def _strip_item_marker(text: str) -> str:
    """Remove a leading '(i)' / '(1)' item marker from a specific activity."""
    return re.sub(r"^\s*\(\s*[ivxlc\d]+\s*\)\s*", "", (text or "")).strip()


def _subject_book(subject_label: str, class_name: str, lang: str) -> str:
    if lang == "sw":
        return f"Kitabu cha somo cha {subject_label} Standard {class_name}, Dar es Salaam"
    return f"{subject_label} Students Book for {class_name}, Dar es Salaam"
