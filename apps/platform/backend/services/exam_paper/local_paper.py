"""Offline structurally-valid NECTA paper builder (Python mirror of TS placeholder)."""

from __future__ import annotations

from copy import deepcopy

MCQ_LABELS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
PART_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"]
_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


def _distribute_marks(total: int, parts: int) -> list[int]:
    base = total // parts
    rem = total % parts
    return [base + (1 if i < rem else 0) for i in range(parts)]


def _form_label(form_level: int) -> str:
    return f"Form {_ROMAN.get(max(1, min(6, form_level)), 'I')}"


def build_offline_paper(
    preset: dict,
    *,
    subject_slug: str,
    form_level: int,
    topics: list[str],
) -> dict:
    topic = topics[0] if topics else subject_slug.title()
    q_num = 1
    sections_out: list[dict] = []

    def _slot_content(slot: dict) -> dict:
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

    if preset.get("sections"):
        for sec in preset["sections"]:
            questions = []
            for slot in sec.get("questions") or []:
                raw = _slot_content(slot)
                q = _normalize_question(raw, slot, q_num)
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
            raw = _slot_content(slot)
            q = _normalize_question(raw, slot, q_num)
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
            "subject": preset.get("subject_name"),
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
