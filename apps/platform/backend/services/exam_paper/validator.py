"""Exam paper generation — paper validation and repair logic."""

from __future__ import annotations

import json
import re

from .constants import section_instruction


def _question_text(q: dict) -> str:
    return str(q.get("text") or q.get("stem") or "").strip()


def validate_necta_paper(paper: dict, preset: dict | None = None) -> tuple[bool, list[str]]:
    """Validate NECTA-style paper_json (mcq_bundle, matching, structured, practical)."""
    issues: list[str] = []
    sections = paper.get("sections") if isinstance(paper, dict) else None
    if not isinstance(sections, list) or not sections:
        return False, ["paper has no sections"]

    preset_sections = (preset or {}).get("sections") or []
    flat_slots = (preset or {}).get("flat_questions") or []

    expected = 1
    total = 0

    def _section_earnable(sec: dict, preset_sec: dict | None) -> int:
        if sec.get("marks") is not None:
            return int(sec["marks"])
        if preset_sec and preset_sec.get("marks") is not None:
            return int(preset_sec["marks"])
        qs = sec.get("questions") or []
        choice = sec.get("choice") or (preset_sec or {}).get("choice") or {}
        q_marks = [int(q.get("marks") or 0) for q in qs if isinstance(q, dict)]
        if choice.get("mode") == "n_of_m":
            n = int(choice.get("n") or 0)
            if n:
                return sum(sorted(q_marks, reverse=True)[:n])
        return sum(q_marks)

    for sec_idx, sec in enumerate(sections):
        preset_sec = preset_sections[sec_idx] if sec_idx < len(preset_sections) else None
        qs = sec.get("questions")
        if not isinstance(qs, list) or not qs:
            issues.append(f"Section {sec.get('id')} has no questions")
            continue
        if preset_sec and len(qs) != len(preset_sec.get("questions") or []):
            issues.append(
                f"Section {sec.get('id')} expected {len(preset_sec.get('questions') or [])} questions, got {len(qs)}"
            )

        for q_idx, q in enumerate(qs):
            slot = None
            if preset_sec and q_idx < len(preset_sec.get("questions") or []):
                slot = preset_sec["questions"][q_idx]
            elif flat_slots and expected - 1 < len(flat_slots):
                slot = flat_slots[expected - 1]

            try:
                if int(q.get("number") or 0) != expected:
                    issues.append(f"expected Q{expected}, found Q{q.get('number')}")
            except (TypeError, ValueError):
                issues.append(f"Q{expected} invalid number")
            expected += 1

            qtype = str(q.get("type") or (slot.get("type") if slot else "") or "")
            if qtype == "mcq_bundle":
                items = q.get("items")
                if not isinstance(items, list) or not items:
                    issues.append(f"Q{q.get('number')} mcq_bundle has no items")
                elif slot and len(items) != int(slot.get("item_count") or 0):
                    issues.append(
                        f"Q{q.get('number')} mcq_bundle expected {slot.get('item_count')} items, got {len(items)}"
                    )
                else:
                    for i, it in enumerate(items):
                        opts = it.get("options") if isinstance(it, dict) else None
                        if not isinstance(opts, dict) or len(opts) < 4:
                            issues.append(f"Q{q.get('number')} item {i + 1} needs 4 options")
            elif qtype == "matching":
                list_a = q.get("listA")
                list_b = q.get("listB")
                answers = q.get("answers")
                if not isinstance(list_a, list) or not list_a:
                    issues.append(f"Q{q.get('number')} matching missing listA")
                elif slot and len(list_a) != int(slot.get("item_count") or 0):
                    issues.append(
                        f"Q{q.get('number')} matching expected {slot.get('item_count')} listA items, got {len(list_a)}"
                    )
                if not isinstance(list_b, list) or not list_b:
                    issues.append(f"Q{q.get('number')} matching missing listB")
                if not isinstance(answers, list) or not answers:
                    issues.append(f"Q{q.get('number')} matching missing answers")
            elif qtype == "practical":
                if not q.get("apparatus"):
                    issues.append(f"Q{q.get('number')} practical missing apparatus")
                if not q.get("parts") and not q.get("tasks"):
                    issues.append(f"Q{q.get('number')} practical missing tasks/parts")
            elif not _question_text(q) and not q.get("parts"):
                issues.append(f"Q{q.get('number')} empty text/stem")

            parts = q.get("parts") or q.get("tasks") or []
            if isinstance(parts, list) and parts:
                try:
                    part_sum = sum(int(p.get("marks") or 0) for p in parts if isinstance(p, dict))
                    q_marks = int(q.get("marks") or 0)
                    if part_sum != q_marks:
                        issues.append(f"Q{q.get('number')} part marks {part_sum} != question marks {q_marks}")
                except (TypeError, ValueError):
                    issues.append(f"Q{q.get('number')} invalid part marks")

        total += _section_earnable(sec, preset_sec)

    header_total = (paper.get("header") or {}).get("total_marks")
    try:
        if header_total is not None and total != int(header_total):
            issues.append(f"marks total {total} != header total {header_total}")
    except (TypeError, ValueError):
        issues.append(f"invalid header total_marks {header_total!r}")

    if preset:
        try:
            preset_total = int(preset.get("total_marks") or 0)
            if preset_total and total != preset_total:
                issues.append(f"marks total {total} != preset total {preset_total}")
        except (TypeError, ValueError):
            issues.append("invalid preset total_marks")

    return (not issues), issues


def validate_paper(paper: dict) -> tuple[bool, list[str]]:
    """Structural validation — numbering, marks totals, section completeness."""
    issues: list[str] = []
    sections = paper.get("sections") if isinstance(paper, dict) else None
    if not isinstance(sections, list) or not sections:
        return False, ["paper has no sections"]

    expected = 1
    total = 0
    for sec in sections:
        qs = sec.get("questions")
        if not isinstance(qs, list) or not qs:
            issues.append(f"Section {sec.get('id')} has no questions")
            continue
        if sec.get("question_type") == "mcq":
            for q in qs:
                opts = q.get("options")
                if not isinstance(opts, list) or len(opts) < 2:
                    issues.append(f"Section {sec.get('id')} Q{q.get('number')} missing options")
                try:
                    if int(q.get("answer")) not in range(4):
                        issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid answer")
                except (TypeError, ValueError):
                    issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid answer")
        for q in qs:
            if not _question_text(q):
                issues.append(f"Section {sec.get('id')} Q{q.get('number')} empty text")
            if int(q.get("number") or 0) != expected:
                issues.append(f"expected Q{expected}, found Q{q.get('number')}")
            expected += 1
            try:
                total += int(q.get("marks") or 0)
            except (TypeError, ValueError):
                issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid marks")

    header_total = (paper.get("header") or {}).get("total_marks")
    try:
        if total != int(header_total or 0):
            issues.append(f"marks total {total} != header total {header_total}")
    except (TypeError, ValueError):
        issues.append(f"invalid header total_marks {header_total!r}")

    return (not issues), issues


def repair_paper(paper: dict) -> dict:
    """Normalize a paper: drop empty questions, renumber, recompute totals."""
    repaired = json.loads(json.dumps(paper))
    header = repaired.get("header") or {}
    sections: list[dict] = []
    n = 1
    for sec in repaired.get("sections") or []:
        qs = [q for q in (sec.get("questions") or []) if isinstance(q, dict) and _question_text(q)]
        out_qs: list[dict] = []
        for q in qs:
            try:
                marks = max(1, int(q.get("marks") or sec.get("marks_per_question") or 1))
            except (TypeError, ValueError):
                marks = max(1, int(sec.get("marks_per_question") or 1))
            entry = {
                "number": n,
                "text": re.sub(r"\s+", " ", _question_text(q)).strip(),
                "marks": marks,
            }
            if sec.get("question_type") == "mcq":
                raw_opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
                while len(raw_opts) < 4:
                    raw_opts.append(f"{chr(65 + len(raw_opts))}. —")
                raw_opts = raw_opts[:4]
                labeled = [
                    o if re.match(r"^[A-Da-d][.)]", o) else f"{chr(65 + i)}. {o}"
                    for i, o in enumerate(raw_opts)
                ]
                answer = q.get("answer")
                if isinstance(answer, int) and not isinstance(answer, bool):
                    idx = answer
                elif isinstance(answer, str) and re.match(r"^[A-Da-d]$", answer.strip()):
                    idx = ord(answer.strip().upper()) - 65
                else:
                    idx = 0
                entry["options"] = labeled
                entry["answer"] = max(0, min(3, idx))
            n += 1
            out_qs.append(entry)
        sec2 = dict(sec)
        sec2["questions"] = out_qs
        sec2["count"] = len(out_qs)
        sec2["marks_per_question"] = max(1, int(sec.get("marks_per_question") or 1))
        sec2["instruction"] = section_instruction(sec2)
        sections.append(sec2)

    total = sum(int(q["marks"]) for s in sections for q in s["questions"])
    header["total_marks"] = total
    repaired["header"] = header
    repaired["sections"] = sections
    repaired["meta"] = repaired.get("meta") or {}
    return repaired


def paper_summary(paper: dict | None) -> dict | None:
    """Light-weight descriptor of a paper (safe to ship in list endpoints)."""
    if not isinstance(paper, dict):
        return None
    header = paper.get("header") or {}
    sections = paper.get("sections") or []
    return {
        "kind": paper.get("kind"),
        "format_label": paper.get("format_label"),
        "subject": header.get("subject"),
        "subject_slug": header.get("subject_slug"),
        "form_label": header.get("form_label"),
        "form_level": header.get("form_level"),
        "topic": header.get("topic"),
        "duration": header.get("duration"),
        "total_marks": header.get("total_marks"),
        "sections": [
            {
                "id": s.get("id"),
                "title": s.get("title"),
                "question_type": s.get("question_type"),
                "count": s.get("count"),
                "marks_per_question": s.get("marks_per_question"),
            }
            for s in sections
            if isinstance(s, dict)
        ],
    }
