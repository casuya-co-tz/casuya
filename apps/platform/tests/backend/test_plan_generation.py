"""Offline lesson-plan generation tests.

Covers ``generate_lesson_plan()``: deterministic offline builder acceptance,
the TIE four-stage progression shape, stage-specific assessment criteria
quality, TIE competence authority, and the returned source marker. The
scheme-of-work coverage lives in ``test_plan_generation_scheme.py``.
"""

import asyncio

from backend.services.teacher_plan_service import generate_lesson_plan
from backend.services.teacher_plans.offline import _progression_quality_issues


def _run(coro):
    return asyncio.run(coro)


def _suppress_reference_grounding(monkeypatch):
    """Keep these tests on the deterministic scaffold / TIE-fallback path."""
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
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline_lesson.ts_get_specific_competences",
        lambda *a, **k: [],
    )


def _generate(**kwargs):
    return _run(generate_lesson_plan(
        subject_slug=kwargs.get("subject_slug", "mathematics"),
        form_level=kwargs.get("form_level", 2),
        topic=kwargs.get("topic", "Algebra"),
        subtopic=kwargs.get("subtopic", "Linear Equations"),
        school_name=kwargs.get("school_name", "X"),
        teacher_name=kwargs.get("teacher_name", "Y"),
        number_of_students=kwargs.get("number_of_students", 40),
        duration_minutes=kwargs.get("duration_minutes", 40),
    ))


def test_lesson_plan_offline_returns_complete_valid_plan(monkeypatch):
    """The deterministic offline builder always returns a complete lesson plan:
    header, competence architecture, progression matrix and evaluation fields."""
    _suppress_reference_grounding(monkeypatch)
    plan, source = _generate()
    assert source == "offline"
    for key in (
        "header", "competence_architecture", "resources_strategies",
        "progression_matrix", "fields", "evaluation_learners", "evaluation_teacher", "remarks",
    ):
        assert key in plan, key
    header = plan["header"]
    assert header["school_name"] == "X"
    assert header["teacher_name"] == "Y"
    assert header["class_name"] == "Form 2"
    matrix = plan["progression_matrix"]
    assert [r["stage"] for r in matrix] == [
        "Introduction", "Competence Development", "Design", "Realizations",
    ]
    for row in matrix:
        for key in ("teacher_activity", "learner_activity", "assessment_criteria"):
            assert (row.get(key) or "").strip(), (row.get("stage"), key)
    # TIE time weights: Introduction 5 / CD 15 / Design 12 / Realizations 8.
    assert [r["time"] for r in matrix] == ["5 min", "15 min", "12 min", "8 min"]


def test_lesson_plan_offline_progression_passes_quality_gate(monkeypatch):
    """Offline generation is deterministic, so the progression quality gate
    passes outright - no AI repair round is ever needed."""
    _suppress_reference_grounding(monkeypatch)
    plan, source = _generate()
    assert source == "offline"
    assert _progression_quality_issues(plan, "en") == []


def test_lesson_plan_offline_keeps_strong_stage_specific_criteria(monkeypatch):
    """Every stage carries its own unique, learner-anchored Assessment Criteria
    built from that stage's Teacher/Learner activities (never a reused generic
    line, never a placeholder token)."""
    _suppress_reference_grounding(monkeypatch)
    plan, _source = _generate()
    matrix = plan["progression_matrix"]
    criteria = []
    for row in matrix:
        c = (row.get("assessment_criteria") or "").strip()
        criteria.append(c)
        lowered = c.lower()
        assert "learners" in lowered or "teacher" in lowered, c
        assert len([w for w in c.split() if w.strip()]) >= 6, c
        assert "{" not in c and "}" not in c, c
    assert len(set(criteria)) == 4, "each stage must have a unique criterion"


def test_lesson_plan_offline_assessment_grounded_by_reference(monkeypatch):
    """The offline builder grounds Assessment Criteria from the reference
    library's authentic per-stage text when a matching topic reference exists."""
    def _ref_grounding(*args, **kwargs):
        return {
            "doc_type": "lesson_plan",
            "title": "Algebra Reference",
            "content": {
                "plan_details": [{
                    "teaching_structure": [
                        {"stage": "Introduction", "assessment_criteria": "Students recall algebraic terms from prior knowledge"},
                        {"stage": "Competence Development", "assessment_criteria": "Students solve linear equations accurately in pairs"},
                        {"stage": "Design", "assessment_criteria": "Students model word problems as equations with variables"},
                        {"stage": "Realizations", "assessment_criteria": "Students present and justify their solutions to the class"},
                    ],
                }],
            },
        }

    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.fetch_reference_grounding", _ref_grounding,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.competences.fetch_reference_grounding", _ref_grounding,
    )
    plan, _source = _generate(
        subject_slug="mathematics", form_level=2, topic="INDICES AND LOGARITHMS",
        subtopic="Laws of Indices", school_name="School", teacher_name="Teacher",
    )
    matrix = plan["progression_matrix"]
    assert matrix[0]["assessment_criteria"] == "Students recall algebraic terms from prior knowledge"
    assert matrix[1]["assessment_criteria"] == "Students solve linear equations accurately in pairs"
    assert matrix[2]["assessment_criteria"] == "Students model word problems as equations with variables"
    assert matrix[3]["assessment_criteria"] == "Students present and justify their solutions to the class"


def test_lesson_plan_offline_topic_titles_never_fill_competences(monkeypatch):
    """Offline generation never puts topic/subtopic TITLES into competence
    fields - the TIE syllabus statements are authoritative instead."""
    _suppress_reference_grounding(monkeypatch)
    plan, source = _generate(
        subject_slug="chemistry", form_level=2, topic="Atomic Structure",
        subtopic="Atomic models", school_name="X", teacher_name="Y",
    )
    assert source == "offline"
    ca = plan["competence_architecture"]
    assert ca["main_competence"].strip()
    assert ca["specific_competence"].strip()
    assert "# ATOMIC STRUCTURE" not in ca["main_competence"]
    assert "# Atomic models" not in ca["specific_competence"]
