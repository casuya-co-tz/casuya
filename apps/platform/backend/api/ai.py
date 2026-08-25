"""AI endpoints — question generation, tutoring, content analysis."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.ai_service import (
    analyze_content,
    generate_quiz_questions,
    get_tutoring_response,
    moderate_content,
    translate_content,
)

router = APIRouter(prefix="/ai", tags=["AI"])


class QuestionRequest(BaseModel):
    lesson_html: str
    count: int = 5


class TutoringRequest(BaseModel):
    question: str
    lesson_context: str = ""


class AnalyzeRequest(BaseModel):
    html_content: str


class ModerateRequest(BaseModel):
    text: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str


@router.post("/questions/generate")
async def api_generate_questions(req: QuestionRequest):
    questions = await generate_quiz_questions(req.lesson_html, req.count)
    return {"questions": questions, "count": len(questions)}


@router.post("/tutoring/explain")
async def api_tutoring(req: TutoringRequest):
    response = await get_tutoring_response(req.question, req.lesson_context)
    return {"response": response}


@router.post("/content/analyze")
async def api_analyze(req: AnalyzeRequest):
    result = await analyze_content(req.html_content)
    return result


@router.post("/content/moderate")
async def api_moderate(req: ModerateRequest):
    result = await moderate_content(req.text)
    return result


@router.post("/content/translate")
async def api_translate(req: TranslateRequest):
    translated = await translate_content(req.text, req.target_language)
    return {"translated": translated}
