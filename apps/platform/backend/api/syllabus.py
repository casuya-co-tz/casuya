"""API endpoints for the NECTA/TIE syllabus.

Provides the curriculum data that the AI agent and platform frontend use
to serve Tanzania-aligned educational content.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.middleware.cache import cache_get, cache_set
from backend.schemas.syllabus import (
    SyllabusSubjectResponse,
    SyllabusSubjectSummary,
    SyllabusTopicResponse,
)
from backend.services import syllabus_service

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


# ── Subjects ───────────────────────────────────────────────────────────────


@router.get("/subjects", response_model=list[SyllabusSubjectSummary])
@router.get("/subjects/", response_model=list[SyllabusSubjectSummary])
def list_syllabus_subjects(
    form_level: int | None = Query(None, description="Filter by form level (1-4)"),
    core_only: bool = Query(False, description="Only return core subjects"),
):
    """List all NECTA/TIE syllabus subjects."""
    cache_key = f"syllabus:subjects:{form_level}:{core_only}"
    cached = cache_get(cache_key, ttl_seconds=600)
    if cached is not None:
        return cached

    result = syllabus_service.list_subjects(form_level=form_level, core_only=core_only)
    cache_set(cache_key, result, ttl=600)
    return result


@router.get("/subjects/{slug}", response_model=SyllabusSubjectResponse)
@router.get("/subjects/{slug}/", response_model=SyllabusSubjectResponse)
def get_syllabus_subject(slug: str):
    """Get a NECTA/TIE subject with all topics, subtopics, and learning outcomes.

    This is the primary endpoint the AI agent uses to understand the
    exact curriculum structure for a subject.
    """
    result = syllabus_service.get_subject_by_slug(slug)
    if not result:
        raise HTTPException(status_code=404, detail=f"Subject '{slug}' not found")
    return result


@router.get("/subjects/{slug}/forms/{form_level}")
@router.get("/subjects/{slug}/forms/{form_level}/")
def get_syllabus_subject_by_form(slug: str, form_level: int):
    """Get a subject's topics for a specific form level.

    Returns only the topics relevant to that form, with subtopics
    and learning outcomes included.
    """
    if form_level < 1 or form_level > 6:
        raise HTTPException(status_code=400, detail="Form level must be between 1 and 6")

    result = syllabus_service.get_subject_with_form(slug, form_level)
    if not result:
        raise HTTPException(status_code=404, detail=f"Subject '{slug}' not found")
    return result


# ── Topics ─────────────────────────────────────────────────────────────────


@router.get("/subjects/{slug}/topics", response_model=list[SyllabusTopicResponse])
@router.get("/subjects/{slug}/topics/", response_model=list[SyllabusTopicResponse])
def list_syllabus_topics(
    slug: str,
    form_level: int = Query(..., description="Form level (1-4)"),
):
    """List topics for a subject and form level."""
    result = syllabus_service.get_topics_for_form(slug, form_level)
    if not result:
        raise HTTPException(status_code=404, detail=f"No topics found for '{slug}' at form {form_level}")
    return result


# ── Subtopics and Outcomes ─────────────────────────────────────────────────


@router.get("/subtopics/{subtopic_id}")
@router.get("/subtopics/{subtopic_id}/")
def get_syllabus_subtopic(subtopic_id: str):
    """Get a specific subtopic with all its learning outcomes."""
    result = syllabus_service.get_subtopic_with_outcomes(subtopic_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Subtopic '{subtopic_id}' not found")
    return result


# ── AI Agent Endpoints ─────────────────────────────────────────────────────


@router.get("/ai/curriculum-context/{slug}/{form_level}")
@router.get("/ai/curriculum-context/{slug}/{form_level}/")
def get_ai_curriculum_context(slug: str, form_level: int):
    """Get the curriculum context string for AI prompt injection.

    Returns a formatted text block describing the exact TIE syllabus
    content for a given subject and form level. The AI tutoring engine
    uses this to ensure responses align with the official curriculum.
    """
    context = syllabus_service.get_curriculum_context(slug, form_level)
    if not context:
        raise HTTPException(status_code=404, detail=f"No curriculum data for '{slug}' at form {form_level}")
    return {"subject": slug, "form_level": form_level, "context": context}


@router.get("/ai/search-outcomes")
@router.get("/ai/search-outcomes/")
def search_syllabus_outcomes(
    q: str = Query(..., description="Search query"),
    subject: str | None = Query(None, description="Filter by subject slug"),
    form_level: int | None = Query(None, description="Filter by form level"),
):
    """Search for learning outcomes matching a text query.

    The AI agent uses this to find relevant syllabus objectives
    when a student asks a question, ensuring the response targets
    the correct TIE learning outcome.
    """
    results = syllabus_service.search_outcomes(q, subject_slug=subject, form_level=form_level)
    return {"query": q, "results": results, "total": len(results)}
