"""Schemas for the NECTA/TIE syllabus API endpoints."""

from __future__ import annotations

from pydantic import BaseModel

# ── Request schemas ────────────────────────────────────────────────────────


class SyllabusSubjectCreate(BaseModel):
    name: str
    code: str
    slug: str
    description: str | None = None
    necta_code: str | None = None
    form_start: int = 1
    form_end: int = 4
    is_core: bool = True


# ── Response schemas ───────────────────────────────────────────────────────


class LearningOutcomeResponse(BaseModel):
    id: str
    description: str
    cognitive_level: str
    order_index: int


class SyllabusSubtopicResponse(BaseModel):
    id: str
    title: str
    code: str | None = None
    description: str | None = None
    order_index: int
    estimated_periods: int | None = None
    outcomes: list[LearningOutcomeResponse] = []


class SyllabusTopicResponse(BaseModel):
    id: str
    title: str
    code: str | None = None
    description: str | None = None
    form_level: int
    order_index: int
    estimated_periods: int | None = None
    necta_weight: str | None = None
    subtopics: list[SyllabusSubtopicResponse] = []


class SyllabusSubjectResponse(BaseModel):
    id: str
    name: str
    code: str
    slug: str
    description: str | None = None
    necta_code: str | None = None
    form_start: int
    form_end: int
    is_core: bool
    topics: list[SyllabusTopicResponse] = []


class SyllabusSubjectSummary(BaseModel):
    """Lightweight subject info without topics (for list endpoints)."""

    id: str
    name: str
    code: str
    slug: str
    necta_code: str | None = None
    form_start: int
    form_end: int
    is_core: bool
    topic_count: int = 0


class SyllabusCoverageResponse(BaseModel):
    """How much of a subject's syllabus has been covered."""

    subject_id: str
    subject_name: str
    form_level: int
    total_topics: int
    total_subtopics: int
    total_outcomes: int
    covered_subtopics: int
    coverage_percentage: float
