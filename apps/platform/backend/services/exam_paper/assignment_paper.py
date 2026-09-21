"""Assignment exam paper generation — NECTA preset catalog for STEM subjects."""

from __future__ import annotations

from .constants import KIND_DURATION
from .generator import build_spec, presets as legacy_presets, resolve_lesson_context
from .local_paper import build_offline_paper
from .necta_presets import list_available_papers, resolve_paper_preset
from .validator import validate_necta_paper, validate_paper

STEM_SUBJECTS = frozenset({"physics", "chemistry", "mathematics"})


def kind_to_test_type(kind: str, form_level: int) -> str:
    if kind == "exercise":
        return "topical"
    if kind == "internal":
        return "monthly"
    if form_level <= 2:
        return "necta_ii"
    if form_level <= 4:
        return "necta_iv"
    return "necta_vi"


def assignment_presets(ctx: dict | None, kind: str) -> dict:
    """Preset metadata for the teacher assignment UI."""
    kind = kind if kind in ("necta", "internal", "exercise") else "internal"
    if not ctx:
        legacy = legacy_presets()
        cfg = legacy.get(kind) or legacy["internal"]
        return {"mode": "legacy", "kind": kind, **cfg}

    subject = (ctx.get("subject_slug") or "").lower()
    form_level = int(ctx.get("form_level") or 4)
    if subject in STEM_SUBJECTS:
        test_type = kind_to_test_type(kind, form_level)
        papers = list_available_papers(subject, form_level, test_type)
        duration = papers[0]["duration"] if papers else KIND_DURATION.get(kind, "2 Hours")
        return {
            "mode": "necta",
            "kind": kind,
            "test_type": test_type,
            "subject_slug": subject,
            "form_level": form_level,
            "papers": papers,
            "duration": duration,
            "label": {
                "necta": "NECTA Style (FTNA/CSEE/ACSEE)",
                "internal": "Internal Examination",
                "exercise": "Class Exercise",
            }.get(kind, kind),
        }

    legacy = legacy_presets(form_level)
    cfg = legacy.get(kind) or legacy["internal"]
    return {"mode": "legacy", "kind": kind, **cfg}


async def generate_assignment_paper(
    ctx: dict,
    kind: str,
    *,
    paper: str = "theory",
    duration: str | None = None,
    sections: list[dict] | None = None,
) -> tuple[dict, str, dict | None, bool, list[str]]:
    """Generate a paper for teacher assignments.

    STEM subjects use the shared NECTA preset catalog (Test Generator parity).
    Other subjects keep the legacy section-based generator.
    """
    subject = (ctx.get("subject_slug") or "").lower()
    form_level = int(ctx.get("form_level") or 4)
    kind = kind if kind in ("necta", "internal", "exercise") else "internal"

    if subject in STEM_SUBJECTS:
        test_type = kind_to_test_type(kind, form_level)
        preset = resolve_paper_preset(subject, form_level, test_type, paper)
        if not preset:
            raise ValueError(f"No NECTA preset for {subject} form {form_level} paper {paper}")

        topics = [t for t in (ctx.get("topic_title"), ctx.get("subtopic_title")) if t]
        if not topics:
            topics = [ctx.get("lesson_title") or subject.title()]

        from backend.services.ai_bridge.tests import generate_test_paper

        paper_obj, meta = await generate_test_paper(
            test_type=test_type,
            subject_slug=subject,
            form_level=form_level,
            topic=ctx.get("subtopic_title") or ctx.get("topic_title") or "",
            topics=topics,
            paper=paper,
        )
        marking = (meta or {}).get("markingScheme")
        if paper_obj:
            valid, issues = validate_necta_paper(paper_obj, preset)
            if valid:
                return paper_obj, (meta or {}).get("source", "casuya-ai"), marking, True, []

        offline = build_offline_paper(
            preset,
            subject_slug=subject,
            form_level=form_level,
            topics=topics,
        )
        paper_obj = offline["paper"]
        marking = offline.get("markingScheme")
        valid, issues = validate_necta_paper(paper_obj, preset)
        return paper_obj, "local", marking, valid, issues

    from backend.services.ai_bridge.exam import generate_exam_paper

    _kind, dur, spec = build_spec(kind, sections, duration)
    paper_obj, generator = await generate_exam_paper(ctx, _kind, spec, dur)
    ok, issues = validate_paper(paper_obj)
    return paper_obj, generator, None, ok, issues


__all__ = [
    "STEM_SUBJECTS",
    "assignment_presets",
    "generate_assignment_paper",
    "kind_to_test_type",
    "resolve_lesson_context",
]
