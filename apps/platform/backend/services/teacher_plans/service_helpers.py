"""Shared helpers for the teacher-plans public service functions.

Extracted from ``service.py`` so the public async API stays focused on the
AI call + offline fallback flow. The heavier post-processing — syllabus-code
resolution, AI repair rounds, progression quality-gating and grounding —
lives here.
"""

from __future__ import annotations

import logging

from backend.services.syllabus_service import get_subject_with_form

from .competences import _authoritative_competences, _build_lesson_plan_topic_codes
from .constants import MAX_PLAN_REPAIR_ATTEMPTS
from .offline import (
    _ground_progression_assessment,
    _normalize_stage_times,
    _patch_weak_progression_from_offline,
    _polish_progression_cells,
    _progression_quality_issues,
    _reference_lesson_grounding,
)
from .service_repair import _repair_lesson_plan_via_ai
from .utils import (
    _fill_lesson_plan_placeholders,
    _is_complete_lesson_plan,
    _parse_plan_json,
    _strip_think_tags,
)

logger = logging.getLogger(__name__)


async def _finalize_ai_lesson_plan(
    result,
    *,
    subject_slug: str,
    form_level: int,
    topic: str,
    subtopic: str | None,
    lang: str,
    curriculum_ctx,
    subject_label: str,
    school_name: str,
    teacher_name: str,
    number_of_students: int,
    students_boys: int | None,
    students_girls: int | None,
    duration_minutes: int,
    period: str,
) -> dict | None:
    """Validate, repair, ground and fill an AI lesson-plan response.

    Returns the finished plan (with TIE codes resolved, the progression table
    quality-gated and assessment grounded) or ``None`` when the raw AI output
    cannot be turned into a complete lesson plan (the caller then falls back to
    the deterministic offline builder).
    """
    # Resolve the real syllabus codes/titles so any leftover '{}' placeholder
    # tokens in the AI output can be filled with authentic values.
    topic_code = topic_title = ""
    sub_code = sub_title = subtopic or ""
    try:
        subject_data = get_subject_with_form(subject_slug, form_level)
        topic_code, sub_code, sub_title = _build_lesson_plan_topic_codes(
            subject_data, topic, subtopic or "", lang)
        topic_title = topic
        for tp in (subject_data or {}).get("topics", []):
            if (tp.get("title") or "").strip().lower() == (topic or "").strip().lower() or \
               (tp.get("code") or "").strip().lower() == (topic or "").strip().lower():
                topic_title = tp.get("title") or topic
                break
    except Exception:
        logger.warning("Could not resolve syllabus codes for placeholder fill", exc_info=True)

    plan = None
    if isinstance(result, dict) and _is_complete_lesson_plan(result):
        plan = result
    elif isinstance(result, dict) and "response" in result:
        raw = _strip_think_tags(result["response"])
        parsed = _parse_plan_json(raw)
        if _is_complete_lesson_plan(parsed):
            plan = parsed

    if plan is None:
        return None

    # Quality gate on the progression table: normalize each cell, then give
    # the AI up to MAX_PLAN_REPAIR_ATTEMPTS rounds to fix its own output
    # until every cell is a meaningful, grammatical, stage-specific sentence.
    # The deterministic offline matrix is used ONLY as the final near-zero
    # recovery when the AI still fails.
    plan = _polish_progression_cells(plan, lang)
    for _repair_try in range(MAX_PLAN_REPAIR_ATTEMPTS):
        issues = _progression_quality_issues(plan, lang)
        if not issues:
            break
        repaired = await _repair_lesson_plan_via_ai(
            plan,
            issues,
            lang=lang,
            curriculum_ctx=curriculum_ctx,
            subject_slug=subject_slug,
            form_level=form_level,
            topic=topic,
            subtopic=subtopic or "",
        )
        if not repaired:
            break
        plan = _polish_progression_cells(repaired, lang)
    if _progression_quality_issues(plan, lang):
        plan = _patch_weak_progression_from_offline(
            plan,
            subject_slug=subject_slug,
            subject_label=subject_label,
            form_level=form_level,
            topic=topic,
            subtopic=subtopic or "",
            school_name=school_name or "School Name",
            teacher_name=teacher_name or "Teacher Name",
            number_of_students=number_of_students or 40,
            students_boys=students_boys,
            students_girls=students_girls,
            duration_minutes=duration_minutes,
            period=period or "Period 1",
            lang=lang,
        )
    _normalize_stage_times(plan, duration_minutes)
    _ai_ref_gl = _reference_lesson_grounding(subject_slug, form_level, topic, subtopic or "")
    # Only bundled, educator-verified reference lessons (e.g. Physics
    # Form One) get to override competences here: keyed docs are not as
    # authoritative as the TIE syllabus for competence statements.
    _ai_verified = _ai_ref_gl if (_ai_ref_gl and _ai_ref_gl.get("__bundled")) else None
    tie_main, tie_spec = _authoritative_competences(
        subject_slug, form_level, topic, lang, ref_gl=_ai_verified)
    if tie_main and tie_spec:
        ca = plan.setdefault("competence_architecture", {})
        ca["main_competence"] = tie_main
        ca["specific_competence"] = tie_spec
    # Ground the Assessment Criteria: reference-library per-stage text wins
    # where a match exists; every other stage is rewritten to explicitly
    # assess that stage's own Teacher Activity and Learner Activity instead
    # of the AI's generic phrasing.
    _ground_progression_assessment(
        plan.get("progression_matrix"), subject_slug, form_level, topic, lang)
    plan.setdefault("header", {})
    plan["header"]["school_name"] = plan["header"].get("school_name") or (school_name or "School Name")
    plan["header"]["teacher_name"] = plan["header"].get("teacher_name") or (teacher_name or "Teacher Name")
    plan["header"]["class_name"] = plan["header"].get("class_name") or f"Form {form_level}"
    return _fill_lesson_plan_placeholders(
            plan,
            topic_code=topic_code,
            topic_title=topic_title,
            sub_code=sub_code,
            sub_title=sub_title,
            duration_minutes=duration_minutes,
        )