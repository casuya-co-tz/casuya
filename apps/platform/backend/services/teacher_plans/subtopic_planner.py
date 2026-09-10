"""Subtopic lesson planner — generate one lesson plan per teaching period."""

from __future__ import annotations

from backend.services.syllabus_service import get_subject_with_form

from .offline import _build_lesson_plan_offline, _scheme_row_for_lesson
from .utils import _distribute_periods, _lang_label, _strip_item_marker


def plan_lessons_for_subtopic(
    *,
    subject_slug: str,
    form_level: int,
    topic: str,
    subtopic: str,
    school_name: str | None = None,
    teacher_name: str | None = None,
    number_of_students: int | None = None,
    students_boys: int | None = None,
    students_girls: int | None = None,
    duration_minutes: int = 40,
    period: str | None = None,
) -> list[dict]:
    """Generate one lesson plan per teaching period for a subtopic.

    The number of lesson plans is determined by the subtopic's period weight,
    distributed across its specific learning activities exactly as the scheme of
    work does via ``_distribute_periods``.  Each learning activity that is
    allocated *N* periods produces *N* individual lessons, each focused on that
    specific learning activity, so the total number of lessons equals the
    subtopic's total allocated periods.
    """
    lang = _lang_label(subject_slug)
    subject_label = subject_slug.replace("-", " ").title()

    # Resolve the topic + subtopic in the authentic syllabus so the schedule and
    # lesson content match the honest per-period allocation from the scheme.
    outcomes: list[str] = []
    spec_periods = 0

    # Preferred source: the matching Scheme-of-Work teaching row (derived from
    # the verbatim TIE syllabus). Its derived (i)/(ii)/(iii) specific activities
    # become the per-period lesson foci and its period split sets the count,
    # exactly mirroring the scheme the teacher planned.
    scheme_row = _scheme_row_for_lesson(subject_slug, form_level, topic, subtopic, lang)
    if scheme_row:
        spec_periods = scheme_row.get("periods") or 0
        sas = scheme_row.get("specific_activities") or []
        outcomes = [_strip_item_marker(s) for s in sas]
        outcomes = [o for o in outcomes if o]
        if not outcomes and scheme_row.get("learning_activities"):
            outcomes = [scheme_row["learning_activities"]]
    else:
        try:
            subject_data = get_subject_with_form(subject_slug, form_level)
        except Exception:
            subject_data = None

        if subject_data and subject_data.get("topics"):
            t = (topic or "").strip().lower()
            for tp in subject_data["topics"]:
                title = (tp.get("title") or "").strip().lower()
                code = (tp.get("code") or "").strip().lower()
                if t and (t in title or title in t or t == code):
                    subtopic_list = tp.get("subtopics") or []
                    st = (subtopic or "").strip().lower()
                    for sp in subtopic_list:
                        s_title = (sp.get("title") or "").strip().lower()
                        s_code = (sp.get("code") or "").strip().lower()
                        if st and (st in s_title or s_title in st or st == s_code):
                            outcomes = [
                                o.get("description", "").strip()
                                for o in (sp.get("outcomes") or [])
                                if o.get("description", "").strip()
                            ]
                            spec_periods = sp.get("estimated_periods") or 0
                            break
                    break

    if spec_periods <= 0:
        spec_periods = 1
    if not outcomes:
        outcomes = [
            f"Explain the basic concepts of {subtopic or topic}",
            f"Apply {subtopic or topic} in different contexts",
        ]
        if lang == "sw":
            outcomes = [
                f"Eleza dhana za msingi za {subtopic or topic}",
                f"Tumia {subtopic or topic} katika miktadha mbalimbali",
            ]

    schedule = _distribute_periods(outcomes, spec_periods)

    lessons: list[dict] = []
    for entry in schedule:
        activity = entry["activity"]
        periods = entry["periods"]
        for idx in range(1, periods + 1):
            lessons.append(_build_lesson_plan_offline(
                subject_slug=subject_slug,
                subject_label=subject_label,
                form_level=form_level,
                topic=topic,
                subtopic=subtopic,
                school_name=school_name or "School Name",
                teacher_name=teacher_name or "Teacher Name",
                number_of_students=number_of_students or 40,
                students_boys=students_boys,
                students_girls=students_girls,
                duration_minutes=duration_minutes,
                period=period or "Period",
                lang=lang,
                learning_activity=activity,
                lesson_number=idx,
                lesson_total=periods,
            ))

    return lessons
