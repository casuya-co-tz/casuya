"""Offline lesson-plan generation tests.

Covers the deterministic offline path used by ``generate_lesson_plan()``:
complete-plan acceptance, TIE competence authority, and validity of the
generated plan. Plans are always produced by the offline builders.
"""

import asyncio

from backend.services.teacher_plan_service import generate_lesson_plan


def _run(coro):
    return asyncio.run(coro)


def test_lesson_plan_offline_generates_complete_plan():
    """The offline builder returns a complete lesson plan (header +
    progression matrix) with the offline source marker."""
    plan, source = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    assert source == "offline"
    assert "header" in plan
    assert "progression_matrix" in plan
    assert len(plan["progression_matrix"]) == 4


def test_lesson_plan_offline_topic_titles_never_fill_competences(monkeypatch):
    """Offline generation never puts topic/subtopic TITLES into competence
    fields - the TIE syllabus statements are authoritative instead."""
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.fetch_reference_grounding",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.competences.fetch_reference_grounding",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.competences.lookup_competence",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.competences.ts_get_specific_competences",
        lambda *a, **k: [],
    )
    plan, source = _run(generate_lesson_plan(
        subject_slug="chemistry", form_level=2, topic="Atomic Structure",
        subtopic="Atomic models", school_name="X", teacher_name="Y",
    ))
    assert source == "offline"
    ca = plan["competence_architecture"]
    assert ca["main_competence"].strip()
    assert ca["specific_competence"].strip()
    assert "# ATOMIC STRUCTURE" not in ca["main_competence"]
    assert "# Atomic models" not in ca["specific_competence"]


def test_lesson_plan_offline_always_returns_valid_plan():
    """Generation never falls back (no AI involved): the offline builder always
    returns a valid four-stage plan."""
    plan, source = _run(generate_lesson_plan(
        subject_slug="physics", form_level=1, topic="Force",
        subtopic="Newton's Laws", school_name="S", teacher_name="T",
    ))
    assert source == "offline"
    assert plan["header"]["class_name"] == "Form 1"
    assert len(plan["progression_matrix"]) == 4
    for row in plan["progression_matrix"]:
        for key in ("teacher_activity", "learner_activity", "assessment_criteria"):
            assert (row.get(key) or "").strip(), (row.get("stage"), key)
