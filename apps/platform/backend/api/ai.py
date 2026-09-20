"""AI endpoints — question generation, tutoring, content analysis."""

from __future__ import annotations

import asyncio
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.startup import check_casuya_ai
from backend.services.ai_bridge.prompts import _SUBJECT_LABELS, _strip_html, check_subject_relevance
from backend.services.ai_bridge.tests import TEST_TYPES, generate_test_questions
from backend.services.ai_service import (
    analyze_content,
    generate_practice_questions,
    generate_quiz_questions,
    get_tutoring_payload,
    moderate_content,
    translate_content,
)

router = APIRouter(prefix="/ai", tags=["AI"])


def _reject_offline(source: str, allow_offline: bool) -> None:
    if not allow_offline and source == "offline":
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable and offline fallback disabled",
        )


@router.get("/status")
async def api_ai_status(_user=Depends(get_current_user)):
    """Report casuya-ai connectivity for admin/teacher dashboards."""
    return check_casuya_ai()


class QuestionRequest(BaseModel):
    lesson_html: str
    count: int = 5
    subject_slug: str | None = None
    form_level: int | None = None


_ALLOWED_SUBJECTS = {"mathematics", "chemistry", "physics"}


class TutoringMessage(BaseModel):
    role: str
    text: str = ""


class TutoringRequest(BaseModel):
    question: str
    lesson_context: str = ""
    lesson_id: str | None = None
    subject_slug: str | None = None
    form_level: int | None = None
    max_questions: int | None = None  # up to 20 practice questions of any type
    messages: list[TutoringMessage] | None = None
    language: str | None = None  # sw | en | both


class AnalyzeRequest(BaseModel):
    html_content: str


class ModerateRequest(BaseModel):
    text: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str


class TestGenerationRequest(BaseModel):
    """Knowledge-base-grounded test/exam generator request (Test Generator)."""

    test_type: str
    topic: str = ""
    subtopic: str = ""
    topics: list[str] = []
    subtopics: list[str] = []
    count: int = 10
    difficulty: str = "medium"
    subject_slug: str | None = None
    form_level: int | None = None


@router.post("/questions/generate")
async def api_generate_questions(
    req: QuestionRequest,
    allow_offline: bool = Query(True, description="When false, return 503 if AI is down"),
    _user=Depends(get_current_user),
):
    if req.subject_slug and req.subject_slug not in _ALLOWED_SUBJECTS:
        raise HTTPException(
            status_code=422,
            detail=f"subject_slug must be one of {sorted(_ALLOWED_SUBJECTS)}",
        )
    if req.form_level is not None and (req.form_level < 1 or req.form_level > 6):
        raise HTTPException(status_code=422, detail="form_level must be between 1 and 6")
    if req.subject_slug:
        mismatch = check_subject_relevance(_strip_html(req.lesson_html), req.subject_slug)
        if mismatch:
            raise HTTPException(status_code=422, detail=mismatch)
    questions, source, kb_hits = await generate_quiz_questions(
        req.lesson_html,
        req.count,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
    )
    _reject_offline(source, allow_offline)
    return {
        "questions": questions,
        "count": len(questions),
        "source": source,
        "kbHits": kb_hits,
        "sourced": bool(kb_hits),
    }


@router.post("/tutoring/explain")
async def api_tutoring(
    req: TutoringRequest,
    allow_offline: bool = Query(True),
    user=Depends(get_current_user),
):
    from backend.services.ai_bridge.tutor_quota import enforce_student_tutor_quota

    enforce_student_tutor_quota(user)
    payload = await get_tutoring_payload(
        req.question,
        req.lesson_context,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        max_questions=req.max_questions,
        lesson_id=req.lesson_id,
        messages=[m.model_dump() for m in (req.messages or [])],
        language=req.language,
    )
    source = payload.get("source", "offline")
    _reject_offline(source, allow_offline)
    return {
        "response": payload["response"],
        "questions": payload["questions"],
        "count": len(payload["questions"]),
        "source": source,
        "sourced": payload.get("sourced", False),
        "kbHits": payload.get("kbHits") or [],
        "formatComplete": payload.get("formatComplete", False),
        "formatLevel": payload.get("formatLevel", "none"),
    }


@router.post("/tutoring/quiz")
async def api_tutoring_quiz(
    req: TutoringRequest,
    allow_offline: bool = Query(True),
    _user=Depends(get_current_user),
):
    """Generate up to 20 practice questions of any type for the topic."""
    questions, source = await generate_practice_questions(
        req.question,
        req.lesson_context,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        count=req.max_questions or 10,
    )
    _reject_offline(source, allow_offline)
    return {"questions": questions, "count": len(questions), "source": source}


@router.post("/tests/generate")
async def api_generate_tests(req: TestGenerationRequest, _user=Depends(get_current_user)):
    """Generate exam-style practice questions grounded in the NECTA/TIE
    knowledge base (Test Generator shared by admin, teacher, and student).

    The casuya-ai route picks the matching past-paper bucket for the test type
    (topical/monthly/midterm/terminal/annual/NECTA Form II/IV/VI) + subject +
    form, grounds the questions on it via RAG, and runs at a low temperature
    (0.1-0.2) so past questions are never copied verbatim.
    """
    if req.test_type not in TEST_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"test_type must be one of {sorted(TEST_TYPES)}",
        )
    if req.subject_slug and req.subject_slug not in _ALLOWED_SUBJECTS:
        raise HTTPException(
            status_code=422,
            detail=f"subject_slug must be one of {sorted(_ALLOWED_SUBJECTS)}",
        )
    if req.form_level is not None and (req.form_level < 1 or req.form_level > 6):
        raise HTTPException(status_code=422, detail="form_level must be between 1 and 6")
    if not req.topic and not req.subtopic and not req.topics and not req.subtopics:
        raise HTTPException(
            status_code=422,
            detail="Provide a topic (or subtopic) to generate the test from",
        )
    if len(req.topics) > 30 or len(req.subtopics) > 30:
        raise HTTPException(status_code=422, detail="At most 30 topics and 30 subtopics per test")
    if any(len(t) > 120 for t in req.topics + req.subtopics):
        raise HTTPException(status_code=422, detail="Topic/subtopic titles must be at most 120 characters")
    if req.count < 1 or req.count > 20:
        raise HTTPException(status_code=422, detail="count must be between 1 and 20")

    questions, meta = await generate_test_questions(
        req.test_type,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        topic=req.topic,
        subtopic=req.subtopic,
        topics=req.topics,
        subtopics=req.subtopics,
        count=req.count,
        difficulty=req.difficulty,
    )
    source = meta.get("source", "offline")
    return {
        "questions": questions,
        "count": len(questions),
        "testType": req.test_type,
        "testTypeLabel": TEST_TYPES.get(req.test_type, req.test_type),
        "grounded": bool(meta.get("grounded")),
        "subject": _SUBJECT_LABELS.get(req.subject_slug or "") or req.subject_slug or "",
        "formLevel": req.form_level,
        "topics": req.topics,
        "subtopics": req.subtopics,
        "kbHits": meta.get("kbHits") or [],
        "source": source,
    }


@router.post("/content/analyze")
async def api_analyze(req: AnalyzeRequest, _user=Depends(get_current_user)):
    result = await analyze_content(req.html_content)
    return result


@router.post("/content/moderate")
async def api_moderate(req: ModerateRequest, _user=Depends(get_current_user)):
    result = await moderate_content(req.text)
    return result


@router.post("/content/translate")
async def api_translate(req: TranslateRequest, _user=Depends(get_current_user)):
    translated, source = await translate_content(req.text, req.target_language)
    return {"translated": translated, "source": source}


# ── SSE Streaming for AI Tutoring (P3-4) ──────────────────────────────────


async def _stream_tutoring_response(
    question: str,
    lesson_context: str,
    subject_slug: str | None,
    form_level: int | None,
    *,
    lesson_id: str | None = None,
    messages: list[dict] | None = None,
    language: str | None = None,
):
    """Yield SSE events — real LLM token stream via casuya-ai (Phase 3A)."""
    from backend.services.ai_bridge.prompts import iter_tutoring_stream_events

    async for event in iter_tutoring_stream_events(
        question,
        lesson_context,
        subject_slug=subject_slug,
        form_level=form_level,
        lesson_id=lesson_id,
        messages=messages,
        language=language,
    ):
        yield event


@router.post("/tutoring/stream")
async def api_tutoring_stream(req: TutoringRequest, user=Depends(get_current_user)):
    from backend.services.ai_bridge.tutor_quota import enforce_student_tutor_quota

    enforce_student_tutor_quota(user)
    """Stream AI tutoring response via Server-Sent Events.

    The frontend connects with EventSource and receives sentence-sized
    chunks progressively, giving students instant feedback on 2G/3G
    instead of waiting 5-10s for the full response.
    """
    return StreamingResponse(
        _stream_tutoring_response(
            req.question,
            req.lesson_context,
            req.subject_slug,
            req.form_level,
            lesson_id=req.lesson_id,
            messages=[m.model_dump() for m in (req.messages or [])],
            language=req.language,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
