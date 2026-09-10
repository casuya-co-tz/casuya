"""Public async API and AI repair for teacher plan generation."""

from __future__ import annotations

import logging

from backend.services.ai_service import _call_ai_service
from backend.services.syllabus_service import get_curriculum_context

from .offline import (
    _build_lesson_plan_offline,
    _build_scheme_offline,
)
from .prompts import _build_lesson_plan_prompt, _build_scheme_prompt
from .service_helpers import _finalize_ai_lesson_plan
from .subtopic_planner import plan_lessons_for_subtopic
from .utils import (
    _is_complete_lesson_plan,
    _is_complete_scheme,
    _lang_label,
    _parse_plan_json,
    _strip_think_tags,
)

logger = logging.getLogger(__name__)


async def generate_lesson_plan(
    *,
    subject_slug: str,
    form_level: int,
    topic: str,
    subtopic: str | None = None,
    school_name: str | None = None,
    teacher_name: str | None = None,
    number_of_students: int | None = None,
    students_boys: int | None = None,
    students_girls: int | None = None,
    duration_minutes: int = 40,
    period: str | None = None,
) -> dict:
    lang = _lang_label(subject_slug)
    curriculum_ctx = get_curriculum_context(subject_slug, form_level)
    subject_label = subject_slug.replace("-", " ").title()

    prompt = _build_lesson_plan_prompt(
        lang=lang,
        curriculum_ctx=curriculum_ctx,
        subject_label=subject_label,
        subject_slug=subject_slug,
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
    )

    result = await _call_ai_service("/api/plans/lesson-plan", {
        "question": prompt,
        "prompt": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
        "topic": topic,
        "subtopic": subtopic or "",
        "school_name": school_name or "School Name",
        "teacher_name": teacher_name or "Teacher Name",
        "number_of_students": number_of_students or 40,
        "students_boys": students_boys,
        "students_girls": students_girls,
        "duration_minutes": duration_minutes,
        "period": period or "Period 1",
        "lang": lang,
    })

    plan = await _finalize_ai_lesson_plan(
        result,
        subject_slug=subject_slug,
        form_level=form_level,
        topic=topic,
        subtopic=subtopic or "",
        lang=lang,
        curriculum_ctx=curriculum_ctx,
        subject_label=subject_label,
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        number_of_students=number_of_students or 40,
        students_boys=students_boys,
        students_girls=students_girls,
        duration_minutes=duration_minutes,
        period=period or "Period 1",
    )

    if plan is not None:
        return plan

    return _build_lesson_plan_offline(
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


async def generate_scheme_of_work(
    *,
    subject_slug: str,
    form_level: int,
    term: str,
    academic_year: str | None = None,
    school_name: str | None = None,
    teacher_name: str | None = None,
    topics: list[str] | None = None,
) -> dict:
    lang = _lang_label(subject_slug)
    curriculum_ctx = get_curriculum_context(subject_slug, form_level)
    subject_label = subject_slug.replace("-", " ").title()

    prompt = _build_scheme_prompt(
        lang=lang,
        curriculum_ctx=curriculum_ctx,
        subject_label=subject_label,
        subject_slug=subject_slug,
        form_level=form_level,
        term=term,
        academic_year=academic_year or "2026",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        topics=topics or [],
    )

    result = await _call_ai_service("/api/plans/scheme-of-work", {
        "question": prompt,
        "prompt": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
        "term": term,
        "academic_year": academic_year or "2026",
        "school_name": school_name or "School Name",
        "teacher_name": teacher_name or "Teacher Name",
        "topics": topics or [],
        "lang": lang,
    })

    plan = None
    if isinstance(result, dict) and _is_complete_scheme(result):
        plan = result
    elif isinstance(result, dict) and "response" in result:
        raw = _strip_think_tags(result["response"])
        parsed = _parse_plan_json(raw)
        if _is_complete_scheme(parsed):
            plan = parsed

    if plan is not None:
        h = plan.setdefault("header", {})
        h.setdefault("school_name", school_name or "School Name")
        h.setdefault("teacher_name", teacher_name or "Teacher Name")
        h.setdefault("subject", subject_label)
        h.setdefault("class_name", f"Form {form_level}")
        h.setdefault("term", term)
        h.setdefault("academic_year", academic_year or "2026")
        return plan

    return _build_scheme_offline(
        subject_slug=subject_slug,
        subject_label=subject_label,
        form_level=form_level,
        term=term,
        academic_year=academic_year or "2026",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        topics=topics or [],
        lang=lang,
    )
