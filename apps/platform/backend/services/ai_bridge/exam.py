"""AI bridge — exam paper generation for teacher assignments."""

from __future__ import annotations

from .client import _call_ai_service, logger
from .prompts import _strip_html


async def _call_exam_ai(
    ctx: dict,
    kind: str,
    sections: list[dict],
    duration: str,
) -> dict | None:
    payload: dict = {
        "kind": kind,
        "subject": ctx.get("subject_name") or "",
        "subject_slug": ctx.get("subject_slug") or "",
        "form_level": ctx.get("form_level") or 1,
        "topic": ctx.get("topic_title") or ctx.get("subtopic_title") or "",
        "lesson_title": ctx.get("lesson_title") or "",
        "context": _strip_html(ctx.get("lesson_content") or "")[:12000],
        "duration": duration,
        "sections": sections,
    }
    if ctx.get("subject_slug") and ctx.get("form_level"):
        try:
            from backend.services.syllabus_service import get_curriculum_context

            curriculum_ctx = get_curriculum_context(ctx["subject_slug"], int(ctx["form_level"]))
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            logger.debug("Could not fetch syllabus context: %s", exc)

    result = await _call_ai_service("/api/exams/generate", payload)
    if result and result.get("paper"):
        return result["paper"]
    return None


async def generate_exam_paper(
    ctx: dict,
    kind: str,
    sections: list[dict],
    duration: str,
) -> tuple[dict, str]:
    """Generate a NECTA/internal-format exam paper for an assignment.

    Primary path: ask the casuya-ai service to compose the question content
    for each section (returns ``(paper, "casuya-ai")``). Fallback — offline,
    service down, or unusable output — builds a complete, valid paper from the
    lesson text via ``exam_paper_service`` (returns ``(paper, "local")``).
    Either way the returned paper is repaired and validated.
    """
    paper = await _call_exam_ai(ctx, kind, sections, duration)
    if paper:
        try:
            from backend.services.exam_paper_service import ensure_paper_complete, repair_paper, validate_paper

            paper = ensure_paper_complete(paper, sections, ctx)
            ok, _issues = validate_paper(paper)
            if ok:
                return repair_paper(paper), "casuya-ai"
        except Exception as exc:
            logger.debug("exam paper repair failed, using local fallback: %s", exc)

    from backend.services.exam_paper_service import generate_exam_paper_local, repair_paper

    paper = generate_exam_paper_local(ctx, kind, sections)
    return repair_paper(paper), "local"
