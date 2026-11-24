"""Teacher plan service - deterministic offline generation.

Lesson plans and schemes of work are produced solely by the deterministic,
offline builders (TIE syllabus grounding + reference-library quality gating).
"""

from backend.services.syllabus_service import get_curriculum_context, get_subject_with_form  # noqa: F401

from .renderers import render_lesson_plan_html, render_scheme_of_work_html  # noqa: F401
from .service import (  # noqa: F401
    generate_lesson_plan,
    generate_scheme_of_work,
    plan_lessons_for_subtopic,
)
from .competences import _tie_competences  # noqa: F401
from .offline import (  # noqa: F401
    _build_lesson_plan_offline,
    _build_scheme_offline,
    _scheme_row_for_lesson,
)
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
    "_distribute_periods",
    "_fill_lesson_plan_placeholders",
    "_lang_label",
    "_strip_item_marker",
]
