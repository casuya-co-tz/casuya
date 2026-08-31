"""AI endpoints — question generation, tutoring, content analysis."""

from __future__ import annotations

import asyncio
import json
import re

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.services.ai_service import (
    analyze_content,
    generate_practice_questions,
    generate_quiz_questions,
    get_tutoring_payload,
    get_tutoring_response,
    moderate_content,
    translate_content,
)

router = APIRouter(prefix="/ai", tags=["AI"])


class QuestionRequest(BaseModel):
    lesson_html: str
    count: int = 5
    subject_slug: str | None = None
    form_level: int | None = None


class TutoringRequest(BaseModel):
    question: str
    lesson_context: str = ""
    subject_slug: str | None = None
    form_level: int | None = None
    max_questions: int | None = None  # up to 20 practice questions of any type


class AnalyzeRequest(BaseModel):
    html_content: str


class ModerateRequest(BaseModel):
    text: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str


@router.post("/questions/generate")
async def api_generate_questions(req: QuestionRequest, _user=Depends(get_current_user)):
    questions = await generate_quiz_questions(
        req.lesson_html,
        req.count,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
    )
    return {"questions": questions, "count": len(questions)}


@router.post("/tutoring/explain")
async def api_tutoring(req: TutoringRequest, _user=Depends(get_current_user)):
    payload = await get_tutoring_payload(
        req.question,
        req.lesson_context,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        max_questions=req.max_questions,
    )
    return {
        "response": payload["response"],
        "questions": payload["questions"],
        "count": len(payload["questions"]),
    }


@router.post("/tutoring/quiz")
async def api_tutoring_quiz(req: TutoringRequest, _user=Depends(get_current_user)):
    """Generate up to 20 practice questions of any type for the topic."""
    questions = await generate_practice_questions(
        req.question,
        req.lesson_context,
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        count=req.max_questions or 10,
    )
    return {"questions": questions, "count": len(questions)}


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
    translated = await translate_content(req.text, req.target_language)
    return {"translated": translated}


# ── SSE Streaming for AI Tutoring (P3-4) ──────────────────────────────────


async def _stream_tutoring_response(
    question: str,
    lesson_context: str,
    subject_slug: str | None,
    form_level: int | None,
):
    """Generator that yields SSE events for the tutoring response.

    Splits the AI response into sentence-sized chunks and streams them
    via Server-Sent Events so the student sees text appear progressively
    instead of waiting for the full response.
    """
    try:
        response = await get_tutoring_response(
            question, lesson_context,
            subject_slug=subject_slug, form_level=form_level,
        )
    except Exception:
        yield f"data: {json.dumps({'chunk': 'The AI tutor is temporarily unavailable.', 'done': True})}\n\n"
        return

    if not response:
        yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
        return

    # Split into sentence-sized chunks for progressive rendering
    # Sentences end with . ! ? or newlines
    chunks = re.split(r'(?<=[.!?])\s+|\n{2,}', response)

    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        yield f"data: {json.dumps({'chunk': chunk + ' '})}\n\n"
        # Small delay between chunks so the frontend can render
        await asyncio.sleep(0.05)

    yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"


@router.post("/tutoring/stream")
async def api_tutoring_stream(req: TutoringRequest, _user=Depends(get_current_user)):
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
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
