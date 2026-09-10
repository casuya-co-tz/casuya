"""Offline fallback builders for lesson plans and schemes of work (facade).

The implementation moved to focused modules:

- ``offline_builder``  — ``_build_lesson_plan_offline`` (the lesson builder)
- ``offline_lesson``   — reference grounding / KB lookup / scheme-row bridge
- ``offline_scheme``   — selected reference rows + ``_build_scheme_offline``
- ``offline_quality``  — progression-cell polishing, time normalization,
  quality-issue detection and midterm weeks

This module keeps the public surface unchanged: every symbol that consumers
and tests import from ``backend.services.teacher_plans.offline`` is re-exported
here, including the ``get_subject_with_form`` / ``fetch_reference_grounding``
attributes the test suite monkeypatches. The split modules resolve those two
through this facade at call time so the patches keep working.
"""

__all__ = [
    "fetch_reference_grounding",
    "get_subject_with_form",
    "_build_lesson_plan_offline",
    "_build_scheme_offline",
    "_ground_progression_assessment",
    "_lookup_lesson_plan_content",
    "_midterm_weeks",
    "_normalize_stage_times",
    "_patch_weak_progression_from_offline",
    "_polish_progression_cells",
    "_progression_quality_issues",
    "_reference_lesson_grounding",
    "_reference_scheme_grounding",
    "_scheme_row_for_lesson",
]

# Seek first, bound in this module so ``offline.get_subject_with_form`` and
# ``offline.fetch_reference_grounding`` stay the monkeypatch-able attributes.
from backend.services.reference_library_service import (  # noqa: F401
    fetch_reference_grounding,
)
from backend.services.syllabus_service import get_subject_with_form  # noqa: F401

from .competences import _ground_progression_assessment  # noqa: F401
from .offline_builder import _build_lesson_plan_offline  # noqa: F401
from .offline_lesson import (  # noqa: F401
    _lookup_lesson_plan_content,
    _patch_weak_progression_from_offline,
    _reference_lesson_grounding,
    _scheme_row_for_lesson,
)
from .offline_quality import (  # noqa: F401
    _midterm_weeks,
    _normalize_stage_times,
    _polish_progression_cells,
    _progression_quality_issues,
)
from .offline_scheme import (  # noqa: F401
    _build_scheme_offline,
    _reference_scheme_grounding,
)