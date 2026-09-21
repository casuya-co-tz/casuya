"""Exam paper service — NECTA-style exam paper generation for assignments."""

from .assignment_paper import (  # noqa: F401
    assignment_presets,
    generate_assignment_paper,
    kind_to_test_type,
)
from .generator import (  # noqa: F401
    build_spec,
    ensure_paper_complete,
    generate_exam_paper_local,
    presets,
    resolve_lesson_context,
)
from .validator import (  # noqa: F401
    paper_summary,
    repair_paper,
    validate_necta_paper,
    validate_paper,
)

__all__ = [
    # Public API
    "assignment_presets",
    "build_spec",
    "ensure_paper_complete",
    "generate_assignment_paper",
    "generate_exam_paper_local",
    "kind_to_test_type",
    "presets",
    "resolve_lesson_context",
    "paper_summary",
    "repair_paper",
    "validate_necta_paper",
    "validate_paper",
]
