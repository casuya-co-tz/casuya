"""AI bridge — knowledge-base-grounded test/exam paper generation (Test Generator)."""

from __future__ import annotations

import logging

from backend.services.exam_paper.necta_presets import list_available_papers, resolve_paper_preset
from backend.services.exam_paper.validator import validate_necta_paper

from .client import AiServiceError, _call_ai_service

logger = logging.getLogger(__name__)

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

PAPER_VARIANTS = ("theory", "theory_2", "practical")


async def get_test_presets(
    subject_slug: str,
    form_level: int,
    test_type: str,
) -> dict:
    """Return available paper presets for the Test Generator UI."""
    try:
        result = await _call_ai_service(
            "/api/tests/presets",
            {"subject_slug": subject_slug, "form_level": form_level, "test_type": test_type},
        )
        if result and result.get("presets") is not None:
            return result
    except AiServiceError as exc:
        logger.warning("AI presets lookup failed: %s", exc)

    return {
        "presets": list_available_papers(subject_slug, form_level, test_type),
        "testType": test_type,
        "formLevel": form_level,
        "source": "local",
    }


async def generate_test_paper(
    test_type: str,
    subject_slug: str | None = None,
    form_level: int | None = None,
    topic: str = "",
    subtopic: str = "",
    topics: list[str] | None = None,
    subtopics: list[str] | None = None,
    paper: str = "theory",
    difficulty: str = "medium",
) -> tuple[dict | None, dict]:
    """Generate a full NECTA-style examination paper."""
    topics = [t.strip() for t in (topics or []) if t and t.strip()]
    subtopics = [t.strip() for t in (subtopics or []) if t and t.strip()]
    payload: dict = {
        "test_type": test_type,
        "topic": topic,
        "subtopic": subtopic,
        "topics": topics[:30],
        "subtopics": subtopics[:30],
        "paper": paper,
        "difficulty": difficulty,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level

    preset = resolve_paper_preset(subject_slug or "", form_level or 0, test_type, paper) if subject_slug and form_level else None

    try:
        result = await _call_ai_service("/api/tests/generate", payload)
        if result and result.get("paper"):
            paper_obj = result["paper"]
            valid, issues = validate_necta_paper(paper_obj, preset)
            if not valid:
                logger.warning("AI paper failed validation: %s", issues)
            else:
                result["source"] = result.get("source", "casuya-ai")
                return paper_obj, result
    except AiServiceError as exc:
        logger.warning("AI test paper generation failed: %s", exc)

    if subject_slug and form_level:
        if not preset:
            preset = resolve_paper_preset(subject_slug, form_level, test_type, paper)
        if preset:
            from backend.services.exam_paper.local_paper import build_offline_paper

            offline_paper = build_offline_paper(
                preset,
                subject_slug=subject_slug,
                form_level=form_level,
                topics=topics or ([topic] if topic else []),
            )
            return offline_paper["paper"], {
                "paper": offline_paper["paper"],
                "markingScheme": offline_paper.get("markingScheme"),
                "preset": {
                    "id": preset["id"],
                    "paper_code": preset["paper_code"],
                    "paper_title": preset["paper_title"],
                    "duration": preset["duration"],
                    "total_marks": preset["total_marks"],
                },
                "grounded": False,
                "kbHits": [],
                "source": "offline",
            }

    return None, {"source": "offline", "grounded": False, "kbHits": []}


# Backward-compatible alias used by older tests
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
    paper: str = "theory",
) -> tuple[list[dict], dict]:
    paper_obj, meta = await generate_test_paper(
        test_type,
        subject_slug=subject_slug,
        form_level=form_level,
        topic=topic,
        subtopic=subtopic,
        topics=topics,
        subtopics=subtopics,
        paper=paper,
        difficulty=difficulty,
    )
    questions = meta.get("questions") or []
    if not questions and paper_obj:
        questions = _flatten_mcq_from_paper(paper_obj)
    meta["questions"] = questions
    meta["count"] = len(questions)
    return questions, meta


def _flatten_mcq_from_paper(paper: dict) -> list[dict]:
    out: list[dict] = []
    for sec in paper.get("sections") or []:
        for q in sec.get("questions") or []:
            if q.get("type") == "mcq_bundle":
                for item in q.get("items") or []:
                    opts = item.get("options") or {}
                    if isinstance(opts, dict):
                        options = [f"{k}. {v}" for k, v in opts.items()]
                    else:
                        options = list(opts)
                    out.append(
                        {
                            "text": f"({item.get('number', '')}) {item.get('text', '')}",
                            "options": options,
                            "correctAnswer": item.get("answer", "A"),
                            "explanation": "",
                        }
                    )
    return out
