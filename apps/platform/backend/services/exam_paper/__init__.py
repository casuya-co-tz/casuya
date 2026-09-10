"""Exam paper service — NECTA-style exam paper generation for assignments."""

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
    validate_paper,
)

__all__ = [
    # Public API
    "build_spec",
    "ensure_paper_complete",
    "generate_exam_paper_local",
    "presets",
    "resolve_lesson_context",
    "paper_summary",
    "repair_paper",
    "validate_paper",
]
