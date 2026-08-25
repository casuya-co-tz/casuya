"""AI service — bridges casuya-platform to the casuya-ai TypeScript service.

Provides question generation, tutoring, and content analysis capabilities
by calling the casuya-ai service over HTTP. Falls back to local regex-based
generation when the AI service is unavailable.
"""

from __future__ import annotations

import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

CASUYA_AI_URL = os.getenv("CASUYA_AI_URL", "http://localhost:3000")


async def _call_ai_service(endpoint: str, payload: dict) -> dict | None:
    """Call the casuya-ai service and return the response, or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{CASUYA_AI_URL}{endpoint}", json=payload)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("casuya-ai service unavailable at %s: %s", CASUYA_AI_URL, exc)
        return None


# ---------- Question Generation ----------


async def generate_quiz_questions(lesson_html: str, count: int = 5) -> list[dict]:
    """Generate quiz questions from lesson HTML.

    Tries the casuya-ai service first; falls back to local regex extraction.
    """
    result = await _call_ai_service(
        "/api/questions/generate",
        {
            "content": lesson_html,
            "count": count,
            "type": "fill-in-blank",
        },
    )
    if result and "questions" in result:
        return result["questions"]

    # Fallback: local regex-based generation
    return _generate_questions_locally(lesson_html, count)


def _generate_questions_locally(lesson_html: str, count: int = 5) -> list[dict]:
    """Fallback: extract fill-in-the-blank questions using regex."""
    text = re.sub(r"<[^>]+>", " ", lesson_html)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 20]
    questions = []
    for sentence in sentences[:count]:
        words = sentence.split()
        if len(words) < 4:
            continue
        blank_idx = len(words) // 2
        answer = words[blank_idx]
        words[blank_idx] = "______"
        prompt = " ".join(words)
        questions.append(
            {
                "prompt": prompt,
                "options": [
                    {"text": answer, "is_correct": True},
                    {"text": answer.upper(), "is_correct": False},
                    {"text": answer.lower(), "is_correct": False},
                    {"text": answer[::-1], "is_correct": False},
                ],
            }
        )
    return questions


# ---------- AI Tutoring ----------


async def get_tutoring_response(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> str:
    """Get an AI tutoring response for a student question.

    When subject_slug and form_level are provided, the TIE syllabus
    curriculum context is fetched and injected into the AI prompt
    so the response aligns with the exact NECTA syllabus.
    """
    payload: dict = {
        "question": question,
        "context": lesson_context,
    }

    # Inject NECTA/TIE curriculum context if subject info is available
    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context

            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
                payload["subject_slug"] = subject_slug
                payload["form_level"] = form_level
        except Exception as exc:
            logger.debug("Could not fetch syllabus context: %s", exc)

    result = await _call_ai_service("/api/tutoring/explain", payload)
    if result and "response" in result:
        return result["response"]

    return "I'm sorry, the AI tutor is currently unavailable. Please try again later or ask your teacher for help."


# ---------- Content Analysis ----------


async def analyze_content(html_content: str) -> dict:
    """Analyze educational content for quality, readability, and completeness."""
    result = await _call_ai_service(
        "/api/content/analyze",
        {
            "content": html_content,
        },
    )
    if result:
        return result

    # Fallback: basic local analysis
    text = re.sub(r"<[^>]+>", " ", html_content)
    words = text.split()
    sentences = re.split(r"[.!?]+", text)
    return {
        "word_count": len(words),
        "sentence_count": len([s for s in sentences if s.strip()]),
        "avg_sentence_length": len(words) / max(len(sentences), 1),
        "has_images": "<img" in html_content.lower(),
        "has_videos": "<video" in html_content.lower() or "youtube" in html_content.lower(),
        "has_quizzes": "quiz" in html_content.lower() or "question" in html_content.lower(),
    }


# ---------- Content Moderation ----------


async def moderate_content(text: str) -> dict:
    """Check content for appropriateness and safety."""
    result = await _call_ai_service(
        "/api/content/moderate",
        {
            "content": text,
        },
    )
    if result:
        return result

    # Fallback: basic pattern matching
    flagged_terms = ["inappropriate", "offensive"]
    lower_text = text.lower()
    flags = [term for term in flagged_terms if term in lower_text]
    return {
        "safe": len(flags) == 0,
        "flags": flags,
        "confidence": 0.5 if flags else 0.9,
    }


# ---------- Translation ----------


async def translate_content(text: str, target_language: str) -> str:
    """Translate educational content to the target language."""
    result = await _call_ai_service(
        "/api/content/translate",
        {
            "content": text,
            "target_language": target_language,
        },
    )
    if result and "translated" in result:
        return result["translated"]

    return text  # Return original if service unavailable


# ---------- Math/STEM ----------


async def solve_equation(formula: str, variables: dict) -> dict:
    """Solve a physics/math equation given variable values."""
    result = await _call_ai_service(
        "/api/math/solve",
        {
            "formula": formula,
            "variables": variables,
        },
    )
    if result:
        return result

    # Fallback: basic evaluation
    try:
        expr = formula
        for name, val in variables.items():
            if isinstance(val, dict) and "value" in val and val["value"] is not None:
                expr = expr.replace(name, str(val["value"]))
        result_val = eval(expr, {"__builtins__": {}}, {})
        return {"result": float(result_val), "formula": formula}
    except Exception:
        return {"error": "Could not solve equation", "formula": formula}


async def generate_math_steps(expression: str, target: str = "") -> list[str]:
    """Generate step-by-step solution for a math problem."""
    result = await _call_ai_service(
        "/api/math/steps",
        {
            "expression": expression,
            "target": target,
        },
    )
    if result and "steps" in result:
        return result["steps"]

    return [f"Expression: {expression}", "Solve step by step..."]


async def convert_units(value: float, from_unit: str, to_unit: str) -> dict:
    """Convert between measurement units."""
    result = await _call_ai_service(
        "/api/math/convert",
        {
            "value": value,
            "from": from_unit,
            "to": to_unit,
        },
    )
    if result:
        return result

    # Fallback: common conversions
    conversions = {
        ("km", "mi"): 0.621371,
        ("mi", "km"): 1.60934,
        ("kg", "lb"): 2.20462,
        ("lb", "kg"): 0.453592,
        ("m", "ft"): 3.28084,
        ("ft", "m"): 0.3048,
        ("c", "f"): lambda c: c * 9 / 5 + 32,
        ("f", "c"): lambda f: (f - 32) * 5 / 9,
        ("l", "gal"): 0.264172,
        ("gal", "l"): 3.78541,
    }
    key = (from_unit.lower(), to_unit.lower())
    if key in conversions:
        factor = conversions[key]
        converted = factor(value) if callable(factor) else value * factor
        return {"value": value, "from": from_unit, "to": to_unit, "result": round(converted, 6)}

    return {"error": f"Unknown conversion: {from_unit} to {to_unit}", "value": value}


async def generate_physics_problem(topic: str, difficulty: str = "medium") -> dict:
    """Generate a physics practice problem."""
    result = await _call_ai_service(
        "/api/math/physics-problem",
        {
            "topic": topic,
            "difficulty": difficulty,
        },
    )
    if result:
        return result

    return {
        "topic": topic,
        "difficulty": difficulty,
        "problem": f"Practice problem on {topic} ({difficulty} level)",
        "hint": "Consider the relevant physical laws and equations.",
    }
