"""AI bridge — knowledge-base-grounded test/exam generation (Test Generator).

Bridges the platform to the casuya-ai ``/api/tests/generate`` route, which
grounds generated questions in the NECTA/TIE knowledge base (past papers,
syllabuses, schemes) for the requested test type (topical/monthly/midterm/
terminal/annual/NECTA Form II/IV/VI) and runs at a low temperature so the
model never copies past questions verbatim.
"""

from __future__ import annotations

import re

from .client import _call_ai_service

TEST_TYPES = {
    "topical": "Topical Test",
    "monthly": "Monthly Test",
    "midterm": "Midterm Test",
    "terminal": "Terminal Test",
    "annual": "Annual Test",
    "necta_ii": "NECTA Form II",
    "necta_iv": "NECTA Form IV",
    "necta_vi": "NECTA Form VI",
}

_SUBJECT_LABELS = {
    "mathematics": "Mathematics",
    "chemistry": "Chemistry",
    "physics": "Physics",
}

_FORM_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


async def generate_test_questions(
    test_type: str,
    subject_slug: str | None = None,
    form_level: int | None = None,
    topic: str = "",
    subtopic: str = "",
    topics: list[str] | None = None,
    subtopics: list[str] | None = None,
    count: int = 10,
    difficulty: str = "medium",
) -> tuple[list[dict], dict]:
    """Generate exam-style practice questions grounded in the NECTA/TIE KB.

    ``topics``/``subtopics`` are multi-selection lists (checkboxes) that scope
    how many topics/subtopics the exam covers. Returns ``(questions, meta)``
    where ``meta`` carries the machine-readable result from the AI service
    (``grounded``, ``kbHits``, ``testTypeLabel``) so the frontend can show
    which papers were used.
    """
    topics = [t.strip() for t in (topics or []) if t and t.strip()]
    subtopics = [t.strip() for t in (subtopics or []) if t and t.strip()]
    payload: dict = {
        "test_type": test_type,
        "topic": topic,
        "subtopic": subtopic,
        "topics": topics[:30],
        "subtopics": subtopics[:30],
        "count": count,
        "difficulty": difficulty,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level

    result = await _call_ai_service("/api/tests/generate", payload)
    if result and result.get("questions"):
        return result["questions"], result

    questions = _generate_test_questions_locally(
        topic or (topics[0] if topics else ""),
        count,
        subject_slug,
        form_level,
    )
    return questions, {"questions": questions, "grounded": False, "kbHits": [], "count": len(questions)}


def _generate_test_questions_locally(
    topic: str,
    count: int = 10,
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> list[dict]:
    """Offline fallback: build basic NECTA-style MCQ questions from the topic.

    Uses the same canonical schema as the AI path so ``renderQuizQuestions``
    works whether or not the casuya-ai service is reachable.
    """
    label = _SUBJECT_LABELS.get((subject_slug or "").lower(), "the subject")
    form_text = _FORM_ROMAN.get(form_level, str(form_level)) if form_level else ""
    scope = f" for {label}{f', Form {form_text}' if form_text else ''}"

    base = [
        (
            f"What key concept in the topic “{topic}” is a student expected to master{scope}?",
            ("The defining concept of the topic", "An unrelated detail", "A rule from another subject", "A random guess"),
            "A",
            f"In this {label} topic, the essential concept is the focus of the lesson.",
        ),
        (
            f"Which of the following is most closely related to “{topic}”{scope}?",
            ("Applications and problems of the topic", "A topic from another subject", "A non-subject matter item", "An unrelated fact"),
            "A",
            f"The question tests recognition of ideas that belong to “{topic}” in {label}.",
        ),
        (
            f"When studying “{topic}”{scope}, the most reliable approach is to",
            ("practice problems and review worked examples", "memorize without understanding", "skip the topic", "guess the answer"),
            "A",
            "Practice and review of worked examples build the competence the syllabus requires.",
        ),
        (
            f"The topic “{topic}” belongs to the study area of",
            (label, "History", "Geography", "Literature"),
            "A",
            f"“{topic}” is studied under {label} in the Tanzanian curriculum.",
        ),
    ]

    questions = []
    for i, (text, options, answer, explanation) in enumerate(base[:count]):
        questions.append(
            {
                "text": text,
                "options": list(options),
                "correctAnswer": answer,
                "explanation": explanation,
            }
        )
    return questions