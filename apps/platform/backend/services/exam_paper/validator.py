"""Exam paper generation — paper validation and repair logic."""

from __future__ import annotations

import json
import re

from .constants import section_instruction


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
            if not str(q.get("text") or "").strip():
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
        qs = [q for q in (sec.get("questions") or []) if isinstance(q, dict) and str(q.get("text") or "").strip()]
        out_qs: list[dict] = []
        for q in qs:
            try:
                marks = max(1, int(q.get("marks") or sec.get("marks_per_question") or 1))
            except (TypeError, ValueError):
                marks = max(1, int(sec.get("marks_per_question") or 1))
            entry = {
                "number": n,
                "text": re.sub(r"\s+", " ", str(q["text"])).strip(),
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
