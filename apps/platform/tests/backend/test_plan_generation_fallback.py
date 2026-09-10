"""Tests for AI lesson-plan fallback and TIE competence override.

Covers complete-plan acceptance, the reported topic-title-in-competence bug
(TIE override), and rejection of incomplete AI output so the generator falls
back to the offline rule-based builder.
"""

from backend.services.teacher_plan_service import generate_lesson_plan


def _run(coro):
    import asyncio

    return asyncio.run(coro)


def _async_return(value):
    async def _fake(*args, **kwargs):
        return value

    return _fake


def _curriculum_ctx(*args, **kwargs):
    return "curriculum"


def test_lesson_plan_uses_complete_ai_plan(monkeypatch):
    """A complete AI lesson-plan JSON (dict with header) is used instead of
    falling back to the offline rule-based builder."""
    ai_plan = {
        "header": {"school_name": "AI School", "teacher_name": "AI Teacher", "class_name": "Form 2"},
        "competence_architecture": {
            "main_competence": "Main", "specific_competence": "Spec",
            "main_learning_activity": "MLA", "specific_learning_activity": "SLA",
            "lesson_objective": "Obj",
        },
        "resources_strategies": {"resources": [], "strategies": []},
        "progression_matrix": [
            {"stage": "Knowledge", "duration_minutes": 10, "activities": []},
            {"stage": "Skills", "duration_minutes": 10, "activities": []},
            {"stage": "Competence", "duration_minutes": 10, "activities": []},
            {"stage": "Realizations", "duration_minutes": 10, "activities": []},
        ],
        "evaluation_learners": [], "evaluation_teacher": [], "remarks": "",
    }
    monkeypatch.setattr(
        "backend.services.teacher_plans.service._call_ai_service",
        _async_return(ai_plan),
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.service.get_curriculum_context",
        _curriculum_ctx,
    )
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    assert plan["header"]["school_name"] == "AI School"
    assert plan["progression_matrix"][3]["stage"] == "Realizations"
    assert plan["competence_architecture"]["main_learning_activity"] == "MLA"


def test_lesson_plan_ai_overrides_topic_title_competences_with_tie(monkeypatch):
    """An AI plan that wrote topic/subtopic TITLES into the competence fields
    (the reported lesson-plans bug) has those fields replaced by the real TIE
    statements before returning."""
    ai_plan = {
        "header": {"school_name": "AI School", "teacher_name": "AI Teacher", "class_name": "Form 2"},
        "competence_architecture": {
            "main_competence": "# ATOMIC STRUCTURE",
            "specific_competence": "# Atomic models",
            "main_learning_activity": "MLA", "specific_learning_activity": "SLA",
            "lesson_objective": "Obj",
        },
        "resources_strategies": {"resources": [], "strategies": []},
        "progression_matrix": [
            {"stage": "Knowledge", "duration_minutes": 10, "activities": []},
            {"stage": "Skills", "duration_minutes": 10, "activities": []},
            {"stage": "Competence", "duration_minutes": 10, "activities": []},
            {"stage": "Realizations", "duration_minutes": 10, "activities": []},
        ],
        "evaluation_learners": [], "evaluation_teacher": [], "remarks": "",
    }
    monkeypatch.setattr(
        "backend.services.teacher_plans.service._call_ai_service",
        _async_return(ai_plan),
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.service.get_curriculum_context",
        _curriculum_ctx,
    )
    plan = _run(generate_lesson_plan(
        subject_slug="chemistry", form_level=2, topic="Atomic Structure",
        subtopic="Atomic models", school_name="X", teacher_name="Y",
    ))
    ca = plan["competence_architecture"]
    assert ca["main_competence"] == "1.0 Demonstrate mastery of basic concepts, theories and principles in Chemistry"
    assert ca["specific_competence"] == "1.1 Demonstrate mastery of concepts, theories and principles in Chemistry"
    assert "# ATOMIC STRUCTURE" not in ca["main_competence"]


def test_lesson_plan_falls_back_on_incomplete_ai(monkeypatch):
    """An incomplete AI lesson-plan JSON (empty header) is rejected so the
    generator falls back to the offline builder."""
    monkeypatch.setattr(
        "backend.services.teacher_plans.service._call_ai_service",
        _async_return({"header": {}}),
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.service.get_curriculum_context",
        _curriculum_ctx,
    )
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    assert "header" in plan
    assert "progression_matrix" in plan