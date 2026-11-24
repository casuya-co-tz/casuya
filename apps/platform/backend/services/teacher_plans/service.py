"""Teacher plan service - deterministic offline generation."""

from __future__ import annotations

import logging

from .offline import (
    _build_lesson_plan_offline,
    _build_scheme_offline,
)
from .subtopic_planner import plan_lessons_for_subtopic
from .utils import _lang_label

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
) -> tuple[dict, str]:
    lang = _lang_label(subject_slug)
    subject_label = subject_slug.replace("-", " ").title()

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
    ), "offline"


async def generate_scheme_of_work(
    *,
    subject_slug: str,
    form_level: int,
    term: str,
    academic_year: str | None = None,
    school_name: str | None = None,
    teacher_name: str | None = None,
    topics: list[str] | None = None,
) -> tuple[dict, str]:
    lang = _lang_label(subject_slug)
    subject_label = subject_slug.replace("-", " ").title()

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
    ), "offline"
