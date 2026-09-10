"""Teacher plan service — AI-powered lesson plan and scheme of work generation."""

from backend.services.syllabus_service import get_curriculum_context, get_subject_with_form  # noqa: F401

from .service import generate_lesson_plan, generate_scheme_of_work, plan_lessons_for_subtopic
from .renderers import render_lesson_plan_html, render_scheme_of_work_html

# Private symbols re-exported for backward compatibility with tests.
from .competences import _tie_competences  # noqa: F401
from .offline import (  # noqa: F401
    _build_lesson_plan_offline,
    _build_scheme_offline,
    _scheme_row_for_lesson,
)
from .prompts import _build_lesson_plan_prompt  # noqa: F401
from .utils import (  # noqa: F401
    _distribute_periods,
    _fill_lesson_plan_placeholders,
    _lang_label,
    _strip_item_marker,
)

__all__ = [
    # Public API
    "generate_lesson_plan",
    "generate_scheme_of_work",
    "plan_lessons_for_subtopic",
    "render_lesson_plan_html",
    "render_scheme_of_work_html",
    # Re-exported from syllabus_service for backward compatibility
    "get_curriculum_context",
    "get_subject_with_form",
    # Private symbols re-exported for backward compatibility with tests
    "_tie_competences",
    "_build_lesson_plan_offline",
    "_build_scheme_offline",
    "_scheme_row_for_lesson",
    "_build_lesson_plan_prompt",
    "_distribute_periods",
    "_fill_lesson_plan_placeholders",
    "_lang_label",
    "_strip_item_marker",
]
