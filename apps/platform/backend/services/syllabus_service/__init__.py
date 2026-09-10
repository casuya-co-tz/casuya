"""Syllabus service — provides NECTA/TIE curriculum data for AI and platform use.

The AI agent queries this service to:
1. Get the exact topic structure for a student's form level and subject
2. Find learning outcomes for content generation
3. Track syllabus coverage for teachers
4. Recommend the next topic to study based on curriculum sequence
"""

from __future__ import annotations

from .context import get_curriculum_context
from .details import (
    get_outcomes_for_subtopic,
    get_subtopic_with_outcomes,
    search_outcomes,
)
from .subjects import (
    get_subject_by_slug,
    get_subject_with_form,
    get_topics_for_form,
    list_subjects,
)

__all__ = [
    "get_curriculum_context",
    "get_outcomes_for_subtopic",
    "get_subject_by_slug",
    "get_subject_with_form",
    "get_subtopic_with_outcomes",
    "get_topics_for_form",
    "list_subjects",
    "search_outcomes",
]