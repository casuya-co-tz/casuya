"""Exam paper generation — NECTA-style paper structure generation.

Builds validated, NECTA-style exam papers as JSON (stored in the
``assignments.paper_json`` column). Question *content* is composed by the
casuya-ai service (see ``ai_bridge.generate_exam_paper``); this module provides
the canonical section layout per exam kind plus the deterministic, offline
fallback that builds a complete paper from the lesson text (2G/3G safe).
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson, Subject, Subtopic, Topic

from .constants import KIND_DURATION, KIND_LABELS, _format_form, _form_level_int, section_instruction
from .local_gen import generate_section_questions_local
from .validator import repair_paper


def build_spec(
    kind: str,
    overrides: list[dict] | None = None,
    duration: str | None = None,
) -> tuple[str, str, list[dict]]:
    """Merge the preset section layout for ``kind`` with teacher overrides."""
    from .constants import SECTIONS_BY_KIND

    kind = kind if kind in SECTIONS_BY_KIND else "internal"
    base = deepcopy(SECTIONS_BY_KIND[kind])
    if overrides:
        by_id = {str(o.get("id")).upper(): o for o in overrides if isinstance(o, dict) and o.get("id")}
        for s in base:
            o = by_id.get(str(s["id"]).upper())
            if not o:
                continue
            try:
                s["count"] = max(1, min(40, int(o.get("count") or s["count"])))
            except (TypeError, ValueError):
                pass
            try:
                s["marks_per_question"] = max(1, min(50, int(o.get("marks_per_question") or s["marks_per_question"])))
            except (TypeError, ValueError):
                pass
    dur = (duration or "").strip() or KIND_DURATION.get(kind, "2 Hours")
    return kind, dur, base


def presets(form_level: int | None = None) -> dict:
    """Canonical section layouts for the teacher UI (exam-presets endpoint)."""
    from .constants import SECTIONS_BY_KIND

    out: dict = {}
    form = _form_level_int(form_level)
    mode = "A-Level (ACSEE)" if form >= 5 else "O-Level (CSEE/FTNA)"
    for kind in ("necta", "internal", "exercise"):
        sections = deepcopy(SECTIONS_BY_KIND[kind])
        for s in sections:
            s["instruction"] = section_instruction(s)
        out[kind] = {
            "label": KIND_LABELS[kind],
            "duration": KIND_DURATION[kind],
            "mode": mode,
            "total_marks": sum(s["count"] * s["marks_per_question"] for s in sections),
            "sections": sections,
        }
    return out


# ---------- lesson context ----------


def resolve_lesson_context(lesson_id: str) -> dict | None:
    """Resolve a lesson to subject slug/name, form level and topic titles."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        row = (
            db.query(Lesson, Subtopic, Topic, Subject)
            .join(Subtopic, Lesson.subtopic_id == Subtopic.id)
            .join(Topic, Subtopic.topic_id == Topic.id)
            .join(Subject, Topic.subject_id == Subject.id)
            .filter(Lesson.id == lesson_id)
            .first()
        )
        if not row:
            return None
        lesson, subtopic, topic, subject = row
        return {
            "lesson_id": str(lesson.id),
            "lesson_title": lesson.title,
            "lesson_content": lesson.content or lesson.package_html or "",
            "subtopic_title": subtopic.title,
            "topic_title": topic.title,
            "subject_slug": subject.slug,
            "subject_name": subject.name,
            "form_level": _form_level_int(topic.form_level),
        }
    finally:
        _gen.close()


# ---------- local (offline) question generation ----------


def generate_exam_paper_local(ctx: dict, kind: str, spec: list[dict]) -> dict:
    """Build a complete, valid paper offline from the lesson content."""
    form_level = ctx.get("form_level") or 1
    sections: list[dict] = []
    for sec in spec:
        qs = generate_section_questions_local(sec, ctx, int(sec.get("count") or 1))
        sections.append(
            {
                "id": sec["id"],
                "title": sec["title"],
                "instruction": section_instruction(sec),
                "question_type": sec.get("question_type"),
                "count": len(qs),
                "marks_per_question": sec.get("marks_per_question"),
                "questions": qs,
            }
        )
    total = sum(int(q["marks"]) for s in sections for q in s["questions"])
    n = 1
    for s in sections:
        for q in s["questions"]:
            q["number"] = n
            n += 1
    kind_label = KIND_LABELS.get(kind, "EXAMINATION")
    header = {
        "exam": kind_label,
        "subject": ctx.get("subject_name", ""),
        "subject_slug": ctx.get("subject_slug", ""),
        "form_level": form_level,
        "form_label": f"{_format_form(form_level)} - {ctx.get('subject_name', '')}",
        "topic": ctx.get("topic_title") or ctx.get("subtopic_title") or "",
        "lesson_title": ctx.get("lesson_title", ""),
        "duration": KIND_DURATION.get(kind, "2 Hours"),
        "year": str(datetime.now(timezone.utc).year),
        "total_marks": total,
        "instructions": [
            f"This paper consists of {len(sections)} section(s) with a total of {total} marks.",
            "Answer ALL questions.",
            "Marks for each question are shown in brackets.",
            (
                "Write all your answers in the space provided below each question."
                if kind == "exercise"
                else "For objective questions choose the correct answer and write its letter. Show your working where necessary."
            ),
        ],
    }
    return {
        "kind": kind,
        "format_label": kind_label,
        "header": header,
        "sections": sections,
        "meta": {"generator": "local", "generated_at": datetime.now(timezone.utc).isoformat()},
    }


def ensure_paper_complete(paper: dict, spec: list[dict], ctx: dict) -> dict:
    """Pad an AI-generated paper up to the requested section sizes using local
    questions, so the teacher always previews a complete paper."""
    paper = repair_paper(paper)
    by_id = {str(s.get("id")).upper(): s for s in (paper.get("sections") or []) if isinstance(s, dict)}
    fixed: list[dict] = []
    for sec in spec:
        target = max(1, min(40, int(sec.get("count") or 1)))
        s = dict(by_id.get(str(sec.get("id")).upper()) or sec)
        qs = [q for q in (s.get("questions") or []) if isinstance(q, dict) and str(q.get("text") or "").strip()]
        have = len(qs)
        if have < target:
            qs.extend(
                generate_section_questions_local(sec, ctx, target - have)
            )
        s["questions"] = qs
        s["count"] = len(qs)
        s["marks_per_question"] = int(sec.get("marks_per_question") or min((int(q.get("marks") or 1) for q in qs), default=1))
        for q in qs:
            q["marks"] = s["marks_per_question"]
        s["instruction"] = section_instruction(sec)
        fixed.append(s)
    paper["sections"] = fixed
    header = dict(paper.get("header") or {})
    header["total_marks"] = sum(int(q["marks"]) for s in fixed for q in s["questions"])
    paper["header"] = header
    return repair_paper(paper)
