"""Offline structurally-valid NECTA paper builder (Python mirror of TS)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

MCQ_LABELS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
PART_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"]
_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}
_OPTS = ["A", "B", "C", "D"]

_APPARATUS: dict[str, list[str]] = {
    "physics": ["Metre rule", "Stopwatch", "Balances", "Measuring cylinder", "String"],
    "chemistry": ["Measuring cylinder", "Bunsen burner", "Test tubes", "Beaker", "Thermometer"],
    "default": ["Metre rule", "Stopwatch", "Measuring cylinder"],
}


def _resolve_offline_dir() -> Path:
    """Locate offline question bank — bundled backend/data copy or monorepo KB."""
    here = Path(__file__).resolve()
    bundled = here.parents[2] / "data" / "offline"
    if (bundled / "offline_questions.json").is_file():
        return bundled
    for ancestor in here.parents:
        candidate = ancestor / "packages" / "ai" / "knowledge_base" / "offline"
        if (candidate / "offline_questions.json").is_file():
            return candidate
    return bundled


_OFFLINE_DIR = _resolve_offline_dir()
_BANK: dict[str, Any] | None = None


def _bank() -> dict[str, Any]:
    global _BANK
    if _BANK is not None:
        return _BANK
    try:
        _BANK = json.loads((_OFFLINE_DIR / "offline_questions.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        _BANK = {}
    return _BANK


def _distribute_marks(total: int, parts: int) -> list[int]:
    base = total // parts
    rem = total % parts
    return [base + (1 if i < rem else 0) for i in range(parts)]


def _form_label(form_level: int) -> str:
    return f"Form {_ROMAN.get(max(1, min(6, form_level)), 'I')}"


def _norm_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def _fill(text: Any, topic: str, subject: str) -> str:
    return str(text or "").replace("{topic}", topic).replace("{subject}", subject)


def _apply_vars(text: str, vars_map: dict[str, list[Any]] | None, seed: int) -> str:
    out = text
    for key, pool in (vars_map or {}).items():
        if not pool:
            continue
        out = out.replace("{" + key + "}", str(pool[seed % len(pool)]))
    return out


def _subject_data(subject_slug: str) -> dict[str, Any]:
    bank = _bank()
    subjects = bank.get("subjects", {})
    return subjects.get(subject_slug) or subjects.get("physics") or {}


def _resolve_unit(subject_data: dict[str, Any], topic_key: str) -> dict[str, Any] | None:
    if not topic_key:
        return None
    units = subject_data.get("units", {})
    if topic_key in units:
        return units[topic_key]
    for key, data in units.items():
        if topic_key in key or key in topic_key:
            return data
    return None


def _render_bundle(slot: dict, subject_data: dict[str, Any], unit_key: str, topic: str, subject: str, seed: int) -> dict:
    count = int(slot.get("item_count") or 10)
    unit = subject_data.get("units", {}).get(unit_key) or {}
    pool: list[dict] = list(unit.get("mcq") or [])
    for key, data in (subject_data.get("units") or {}).items():
        if key == unit_key:
            continue
        pool += data.get("mcq") or []
    pool += (subject_data.get("fallback") or {}).get("mcq") or []

    items = []
    seen: set[str] = set()
    cursor = seed % max(1, len(pool))
    for i in range(count):
        if not pool:
            text = f"Which statement about {topic} is correct?"
            options = {
                "A": "Correct concept",
                "B": "Unrelated idea",
                "C": "Common misconception",
                "D": "Another distractor",
            }
            answer = "A"
        else:
            tpl = pool[cursor % len(pool)]
            guard = 0
            while tpl["stem"] in seen and guard < len(pool):
                cursor += 1
                tpl = pool[cursor % len(pool)]
                guard += 1
            seen.add(tpl["stem"])
            cursor += 1
            text = _fill(tpl["stem"], topic, subject)
            rotation = (seed + i) % 4
            option_list = [str(tpl["answer"])] + [str(d) for d in (tpl.get("distractors") or [])[:3]]
            rotated = option_list[rotation:] + option_list[:rotation]
            options = {chr(65 + k): rotated[k] for k in range(4)}
            answer = chr(65 + ((4 - rotation) % 4))
        items.append({"number": MCQ_LABELS[i], "text": text, "options": options, "answer": answer, "marks": 1})

    stem = slot.get("stem") or f"For each of the items (i)-({MCQ_LABELS[count - 1]}), choose the correct answer."
    return {"type": "mcq_bundle", "stem": stem, "items": items}


def _render_matching(slot: dict, subject_data: dict[str, Any], unit_key: str, topic: str, subject: str) -> dict:
    count = int(slot.get("item_count") or 5)
    unit = subject_data.get("units", {}).get(unit_key) or {}
    template = unit.get("matching") or (subject_data.get("fallback") or {}).get("matching")
    if template and template.get("listA"):
        list_a = [_fill(a, topic, subject) for a in template["listA"][:count]]
        answers = [str(a) for a in template.get("answers") or []][:count]
    else:
        list_a = [_fill(f"Term {i + 1} related to {topic}", topic, subject) for i in range(count)]
        answers = [chr(65 + i) for i in range(count)]
    while len(list_a) < count:
        list_a.append(_fill(f"Term {len(list_a) + 1} related to {topic}", topic, subject))
        answers.append(chr(65 + len(list_a) - 1))
    list_b = [_fill(b, topic, subject) for b in (template.get("listB") or [])] if template else []
    while len(list_b) < count + 2:
        list_b.append(_fill(f"Response {len(list_b) + 1} for {topic}", topic, subject))
    stem = slot.get("stem") or "Match each item in List A with the correct response in List B."
    return {"type": "matching", "stem": stem, "listA": list_a, "listB": list_b, "answers": answers}


def _render_structured(slot: dict, subject_data: dict[str, Any], unit_key: str, topic: str, subject: str, seed: int) -> dict:
    unit = subject_data.get("units", {}).get(unit_key) or _resolve_unit(subject_data, unit_key) or {}
    fallback = subject_data.get("fallback") or {}
    if slot.get("type") == "essay":
        src = list(unit.get("essay") or []) + list(unit.get("structured") or [])
    else:
        src = list(unit.get("structured") or [])
    if not src:
        src = list(fallback.get("essay") or []) + list(fallback.get("structured") or [])

    if src:
        tpl = src[seed % len(src)]
    else:
        tpl = {"stem": f"Answer the question on {topic}.", "parts": ["Provide a clear and complete answer."]}

    stem = _fill(_apply_vars(str(tpl.get("stem", "")), tpl.get("vars"), seed), topic, subject)
    desired = max(1, int(slot.get("part_count") or 2))
    part_texts = [_fill(_apply_vars(p, tpl.get("vars"), seed), topic, subject) for p in (tpl.get("parts") or [])]
    part_texts = part_texts[:desired]
    while len(part_texts) < desired:
        part_texts.append("Show all working and explain your reasoning clearly.")
    marks = _distribute_marks(int(slot.get("marks") or 10), desired)

    return {"type": slot.get("type") or "structured", "text": stem, "parts": [{"text": p, "marks": m} for p, m in zip(part_texts, marks, strict=True)]}


def _render_practical(slot: dict, subject_slug: str, topic: str, subject: str) -> dict:
    apparatus = _APPARATUS.get(subject_slug) or _APPARATUS["default"]
    marks = _distribute_marks(int(slot.get("marks") or 25), int(slot.get("part_count") or 3))
    return {
        "type": "practical",
        "text": f"Carry out the practical investigation related to {topic} and record your results.",
        "apparatus": apparatus,
        "procedure": [
            "Set up the apparatus as instructed.",
            "Take readings and record them in the table below.",
            "Calculate the required quantity and state your conclusion.",
        ],
        "tables": [{"title": "Results", "columns": ["Trial", "Reading 1", "Reading 2"], "rows": 4}],
        "parts": [
            {"label": PART_LABELS[i], "text": f"({PART_LABELS[i]}) Perform the measurements and record the readings.", "marks": m}
            for i, m in enumerate(marks)
        ],
    }


def _legacy_slot_content(slot: dict, topic: str) -> dict:
    stype = slot.get("type", "structured")
    if stype == "mcq_bundle":
        count = int(slot.get("item_count") or 10)
        return {
            "type": "mcq_bundle",
            "stem": slot.get("stem"),
            "items": [
                {
                    "number": MCQ_LABELS[i],
                    "text": f"({MCQ_LABELS[i]}) Which statement about {topic} is correct?",
                    "options": {
                        "A": "Correct concept",
                        "B": "Unrelated idea",
                        "C": "Common misconception",
                        "D": "Another distractor",
                    },
                    "answer": "A",
                    "marks": 1,
                }
                for i in range(count)
            ],
        }
    if stype == "matching":
        count = int(slot.get("item_count") or 5)
        return {
            "type": "matching",
            "stem": slot.get("stem"),
            "listA": [f"Term {i + 1} about {topic}" for i in range(count)],
            "listB": ["Definition A", "Definition B", "Definition C", "Definition D", "Definition E", "Definition F"],
            "answers": [chr(65 + (i % 6)) for i in range(count)],
        }
    if stype == "practical":
        parts = _distribute_marks(int(slot.get("marks") or 25), int(slot.get("part_count") or 3))
        return {
            "type": "practical",
            "text": f"Practical investigation related to {topic}.",
            "apparatus": ["Metre rule", "Stopwatch", "Measuring cylinder"],
            "procedure": [
                "Arrange the apparatus.",
                "Take readings and record in the table.",
                "Calculate the required quantity.",
            ],
            "tables": [{"title": "Readings", "columns": ["Trial", "Time (s)"], "rows": 4}],
            "parts": [
                {"label": PART_LABELS[i], "text": f"({PART_LABELS[i]}) Complete the task.", "marks": m}
                for i, m in enumerate(parts)
            ],
        }
    parts = _distribute_marks(int(slot.get("marks") or 10), int(slot.get("part_count") or 2))
    return {
        "type": stype,
        "stem": f"Question on {topic}.",
        "parts": [
            {"label": PART_LABELS[i], "text": f"({PART_LABELS[i]}) Explain using {topic}.", "marks": m}
            for i, m in enumerate(parts)
        ],
    }


def build_offline_paper(
    preset: dict,
    *,
    subject_slug: str,
    form_level: int,
    topics: list[str],
) -> dict:
    topics = [t for t in (topics or []) if str(t).strip()]
    topic_list = topics or [subject_slug.title()]
    subject_label = preset.get("subject_name") or subject_slug.title()
    subject_data = _subject_data(subject_slug)
    bank_ok = bool(subject_data)
    q_num = 1
    sections_out: list[dict] = []
    slot_idx = 0

    def _slot_content(slot: dict, topic: str) -> dict:
        stype = slot.get("type", "structured")
        if not bank_ok:
            return _legacy_slot_content(slot, topic)
        unit_key = _norm_key(topic)
        if stype == "mcq_bundle":
            return _render_bundle(slot, subject_data, unit_key, topic, subject_label, slot_idx)
        if stype == "matching":
            return _render_matching(slot, subject_data, unit_key, topic, subject_label)
        if stype == "practical":
            return _render_practical(slot, subject_slug, topic, subject_label)
        return _render_structured(slot, subject_data, unit_key, topic, subject_label, slot_idx)

    if preset.get("sections"):
        for sec in preset["sections"]:
            questions = []
            for slot in sec.get("questions") or []:
                topic = topic_list[slot_idx % len(topic_list)]
                raw = _slot_content(slot, topic)
                q = _normalize_question(raw, slot, q_num)
                slot_idx += 1
                q_num += 1
                questions.append(q)
            sections_out.append(
                {
                    "id": sec["id"],
                    "title": sec["title"],
                    "marks": sec.get("marks"),
                    "instruction": sec.get("instruction", ""),
                    "choice": sec.get("choice") or {"mode": "all"},
                    "questions": questions,
                }
            )
    elif preset.get("flat_questions"):
        questions = []
        for slot in preset["flat_questions"]:
            topic = topic_list[slot_idx % len(topic_list)]
            raw = _slot_content(slot, topic)
            q = _normalize_question(raw, slot, q_num)
            slot_idx += 1
            q_num += 1
            questions.append(q)
        sections_out.append(
            {
                "id": "A",
                "title": preset.get("paper_title", "QUESTIONS"),
                "marks": preset.get("total_marks"),
                "instruction": "Answer ALL questions.",
                "choice": preset.get("choice") or {"mode": "all"},
                "questions": questions,
            }
        )

    total = sum(int(s.get("marks") or 0) for s in sections_out)
    if not total:
        total = sum(q.get("marks", 0) for s in sections_out for q in s.get("questions") or [])

    paper = {
        "kind": "necta",
        "format_label": preset.get("assessment_type"),
        "header": {
            "country": "THE UNITED REPUBLIC OF TANZANIA",
            "exam_body": preset.get("exam_body"),
            "assessment_type": preset.get("assessment_type"),
            "exam": preset.get("assessment_type"),
            "subject": subject_label,
            "subject_slug": subject_slug,
            "subject_code": preset.get("subject_code"),
            "paper_code": preset.get("paper_code"),
            "paper_title": preset.get("paper_title"),
            "candidate_kind": preset.get("candidate_kind"),
            "id_label": preset.get("id_label"),
            "form_level": form_level,
            "form_label": _form_label(form_level),
            "topic": ", ".join(topics[:3]),
            "duration": preset.get("duration"),
            "year": str(__import__("datetime").datetime.now().year),
            "total_marks": total or preset.get("total_marks"),
            "instructions": preset.get("instructions") or [],
            "materials": preset.get("materials") or [],
            "constants": preset.get("constants") or [],
            "confidential": preset.get("confidential"),
        },
        "assessor_table": preset.get("assessor_table"),
        "sections": sections_out,
        "meta": {"generator": "offline", "preset_id": preset.get("id")},
    }

    marking = _marking_from_paper(paper)
    return {"paper": paper, "markingScheme": marking}


def _normalize_question(raw: dict, slot: dict, number: int) -> dict:
    q: dict = {
        "number": number,
        "type": slot.get("type", raw.get("type", "structured")),
        "marks": slot.get("marks", 0),
        "text": raw.get("text") or raw.get("stem") or slot.get("stem") or f"Question {number}",
        "optional": slot.get("optional"),
    }
    if q["type"] == "mcq_bundle":
        q["items"] = raw.get("items") or []
    elif q["type"] == "matching":
        q["listA"] = raw.get("listA") or []
        q["listB"] = raw.get("listB") or []
        q["answers"] = raw.get("answers") or []
    elif q["type"] == "practical":
        q["apparatus"] = raw.get("apparatus") or []
        q["procedure"] = raw.get("procedure") or []
        q["tables"] = raw.get("tables") or []
        q["parts"] = raw.get("parts") or raw.get("tasks") or []
    else:
        q["parts"] = raw.get("parts") or raw.get("sub_questions") or []
    return q


def _marking_from_paper(paper: dict) -> dict:
    sections = []
    for sec in paper.get("sections") or []:
        qs = []
        for q in sec.get("questions") or []:
            entry: dict = {"number": q.get("number"), "marks": q.get("marks")}
            if q.get("type") == "mcq_bundle":
                entry["items"] = [
                    {"number": it.get("number"), "answer": it.get("answer"), "marks": it.get("marks", 1)}
                    for it in q.get("items") or []
                ]
            elif q.get("type") == "matching":
                entry["answer_html"] = ", ".join(q.get("answers") or [])
            elif q.get("parts"):
                entry["answer_html"] = " ".join(f"({p.get('label')}) [{p.get('marks')} marks]" for p in q["parts"])
            qs.append(entry)
        sections.append({"name": f"SECTION {sec.get('id')}", "marks": sec.get("marks"), "questions": qs})
    h = paper.get("header") or {}
    return {
        "code": h.get("subject_code"),
        "subject": h.get("subject"),
        "max_marks": h.get("total_marks"),
        "sections": sections,
    }
