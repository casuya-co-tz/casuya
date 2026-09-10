"""Tests for AI-driven scheme of work generation.

Covers generate_scheme_of_work() against AI mocks: complete-scheme acceptance,
incomplete-AI fallback, and the shared TIE competence override path.
"""

from backend.services.teacher_plan_service import generate_scheme_of_work


def _run(coro):
    import asyncio

    return asyncio.run(coro)


def _async_return(value):
    async def _fake(*args, **kwargs):
        return value

    return _fake


def _curriculum_ctx(*args, **kwargs):
    return "curriculum"


def test_scheme_of_work_uses_complete_ai_plan(monkeypatch):
    """A complete AI scheme-of-work JSON is used instead of falling back to the
    offline builder."""
    ai_scheme = {"header": {"school_name": "AI School", "teacher_name": "AI Teacher"}, "weeks": [
        {"week": 1, "topic": "Algebra", "main_competence": "Main", "specific_competence": "Spec",
         "learning_activities": [], "specific_activities": [], "periods": 2,
         "month": "January", "reference": "R"},
    ]}
    monkeypatch.setattr(
        "backend.services.teacher_plans.service._call_ai_service",
        _async_return(ai_scheme),
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.service.get_curriculum_context",
        _curriculum_ctx,
    )
    plan = _run(generate_scheme_of_work(
        subject_slug="mathematics", form_level=1, term="Term 1",
        school_name="X", teacher_name="Y", topics=["Algebra"],
    ))
    assert plan["header"]["school_name"] == "AI School"
    assert len(plan["weeks"]) == 1


def test_scheme_of_work_falls_back_on_incomplete_ai(monkeypatch):
    """An incomplete AI scheme JSON (empty header) falls back to the offline
    builder."""
    monkeypatch.setattr(
        "backend.services.teacher_plans.service._call_ai_service",
        _async_return({"header": {}}),
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.service.get_curriculum_context",
        _curriculum_ctx,
    )
    plan = _run(generate_scheme_of_work(
        subject_slug="mathematics", form_level=1, term="Term 1",
        school_name="X", teacher_name="Y", topics=["Algebra"],
    ))
    assert "header" in plan
    assert len(plan["weeks"]) > 0