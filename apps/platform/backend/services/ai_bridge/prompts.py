"""AI bridge — prompt/payload construction for question generation, tutoring
and content analysis, with HTML stripping and local fallback builders."""

from __future__ import annotations

import re

from .client import _call_ai_service


# ---------- HTML Stripping ----------


def _strip_html(html: str) -> str:
    """Strip HTML tags, scripts, styles, and decode entities to plain text."""
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<!\-\-[\s\S]*?\-\->", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\\(?:text|mathrm|frac|sqrt|left|right|rightarrow|Rightarrow)\{[^}]*\}", " ", text)
    text = re.sub(r"[\$\\][\s\S]{0,10}?\{[^}]*\}", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_topic_from_text(text: str) -> str:
    """Pull a short topic phrase from plain text (usually the first sentence or heading)."""
    first_line = text.split(".")[0].split(":")[-1].strip()
    words = first_line.split()[:12]
    return " ".join(words) if words else "lesson content"


# ---------- Question Generation ----------


async def generate_quiz_questions(
    lesson_html: str,
    count: int = 5,
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> list[dict]:
    """Generate NECTA-style quiz questions from lesson HTML.

    Strips HTML tags before sending to the AI service so the model
    sees plain educational text, not markup/CSS code.
    """
    plain_text = _strip_html(lesson_html)
    topic = _extract_topic_from_text(plain_text)

    payload: dict = {
        "content": plain_text,
        "count": count,
        "topic": topic,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level

    result = await _call_ai_service("/api/questions/generate", payload)
    if result and "questions" in result:
        return result["questions"]

    return _generate_questions_locally(plain_text, count)


def _generate_questions_locally(lesson_html: str, count: int = 5) -> list[dict]:
    """Offline fallback: build multiple-choice questions from sentence text.

    Emits the SAME canonical schema as the AI path so the shared renderer
    (renderQuizQuestions) works whether or not the casuya-ai service is
    reachable — critical for the platform's offline-first / 2G target.
    """
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
        distractors = [
            answer.upper(),
            answer.lower(),
            answer[::-1],
        ]
        # De-duplicate distractors against the answer and each other.
        seen = {answer.lower()}
        opts = [answer]
        for d in distractors:
            if d.lower() not in seen:
                seen.add(d.lower())
                opts.append(d)
        # Pad to exactly 4 unique-ish options if the sentence was too short.
        filler = 1
        while len(opts) < 4:
            candidate = f"option {filler}"
            if candidate not in seen:
                opts.append(candidate)
            filler += 1
        questions.append(
            {
                "text": prompt,
                "options": opts,
                "correctAnswer": "A",
                "explanation": f"The missing word is “{answer}”.",
            }
        )
    return questions


# ---------- AI Tutoring ----------


async def get_tutoring_response(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    max_questions: int | None = None,
) -> str:
    """Get an AI tutoring response for a student question.

    When subject_slug and form_level are provided, the TIE syllabus
    curriculum context is fetched and injected into the AI prompt
    so the response aligns with the exact NECTA syllabus. The AI service
    also grounds its answer on the knowledge base (RAG) scoped to the
    user's subject and class/form, and may append practice questions.
    """
    payload: dict = {
        "question": question,
        "context": lesson_context,
    }

    # Always pass subject when known so the AI service can trigger KB RAG retrieval.
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level
    if max_questions:
        payload["max_questions"] = max_questions

    # Inject NECTA/TIE curriculum context if subject info is available
    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context

            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            from .client import logger

            logger.debug("Could not fetch syllabus context: %s", exc)

    result = await _call_ai_service("/api/tutoring/explain", payload)
    if result and "response" in result:
        response = result["response"]
        # Strip  thinking... response blocks from models that use chain-of-thought
        # Some models (e.g. Qwen) emit  thinking without a closing tag
        response = re.sub(r" thinking[\s\S]*?<\/think>", "", response).strip()
        if " thinking" in response:
            # No closing tag — take everything after the last  thinking block
            parts = response.split(" thinking")
            response = parts[-1].strip()
        return response

    return "I'm sorry, the AI tutor is currently unavailable. Please try again later or ask your teacher for help."


async def get_tutoring_payload(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    max_questions: int | None = None,
) -> dict:
    """Like get_tutoring_response but returns the full AI payload, including any
    practice questions the AI service generated (up to 20 of any type)."""
    payload: dict = {
        "question": question,
        "context": lesson_context,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level
    if max_questions:
        payload["max_questions"] = max_questions
    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context
            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            from .client import logger

            logger.debug("Could not fetch syllabus context: %s", exc)

    result = await _call_ai_service("/api/tutoring/explain", payload)
    if result and "response" in result:
        questions = result.get("questions") or []
        response = re.sub(r" thinking[\s\S]*?<\/think>", "", result["response"]).strip()
        if " thinking" in response:
            response = response.split(" thinking")[-1].strip()
        return {
            "response": response,
            "questions": questions,
            "sourced": bool(result.get("sourced")),
            "kbHits": result.get("kbHits") or [],
        }
    return {
        "response": "I'm sorry, the AI tutor is currently unavailable. Please try again later or ask your teacher for help.",
        "questions": [],
        "sourced": False,
        "kbHits": [],
    }


async def generate_practice_questions(
    question: str = "",
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    count: int = 10,
) -> list[dict]:
    """Generate up to 20 practice questions of any type for the given topic.

    Delegates to the casuya-ai /api/tutoring/quiz endpoint, which scopes the
    questions to the user's subject and class/form and grounds them in the
    NECTA/TIE knowledge base.
    """
    payload: dict = {
        "question": question,
        "context": lesson_context,
        "count": count,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level

    result = await _call_ai_service("/api/tutoring/quiz", payload)
    if result and "questions" in result:
        return result["questions"]
    return []


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
