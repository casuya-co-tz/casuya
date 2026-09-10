"""AI repair of a generated lesson plan.

Extracted from ``service.py`` (whose ~404-line budget this function helped
push over). The AI service seam is resolved through the ``service`` package
facade at call time so ``test_plan_generation``'s monkeypatch of
``service._call_ai_service`` keeps working.
"""

from __future__ import annotations

import json

from . import service as _service


async def _repair_lesson_plan_via_ai(plan, issues, *, lang, curriculum_ctx,
                                     subject_slug, form_level, topic, subtopic):
    """Ask the AI to repair its own lesson plan, fixing exactly the cited cells.
    Returns the repaired plan or None when repair fails."""
    issue_text = "\n".join(f"- {i}" for i in issues)
    repair_prompt = (
        "You generated the following JSON lesson plan, but the quality checker "
        "rejected it. Repair ONLY the cited cells.\n\n"
        f"REJECTION REASONS:\n{issue_text}\n\n"
        "REQUIREMENTS:\n"
        "- Keep the exact JSON structure and leave every uncited field untouched.\n"
        "- Fix each cited cell with a complete, grammatically correct sentence.\n"
        "- Each assessment_criteria must be a UNIQUE, observable evaluation of THAT "
        "stage: it checks what the teacher does AND what the learners do in that "
        "stage, naming actor + action + success condition. Never use generic filler.\n"
        "- Exactly 4 stages, in order: Introduction, Competence Development, Design, "
        "Realizations.\n"
        "- Stay strictly within the curriculum context; never invent content.\n"
        "CRITICAL: Output ONLY the repaired JSON - no markdown, no explanations.\n\n"
        f"LANGUAGE: {'Kiswahili' if lang == 'sw' else 'English'}\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        "CURRENT JSON (fix in place):\n"
        f"{json.dumps(plan, indent=2, ensure_ascii=False)}\n"
    )
    try:
        result = await _service._call_ai_service("/api/plans/lesson-plan", {
            "question": repair_prompt,
            "prompt": repair_prompt,
            "context": curriculum_ctx,
            "subject_slug": subject_slug,
            "form_level": form_level,
            "topic": topic,
            "subtopic": subtopic or "",
            "lang": lang,
        })
    except Exception:
        _service.logger.warning("AI lesson-plan repair attempt failed", exc_info=True)
        return None
    if isinstance(result, dict) and _service._is_complete_lesson_plan(result):
        return result
    if isinstance(result, dict) and "response" in result:
        parsed = _service._parse_plan_json(_service._strip_think_tags(result["response"]))
        if _service._is_complete_lesson_plan(parsed):
            return parsed
    return None