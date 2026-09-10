"""Tests for AI-driven lesson plan generation acceptance and repair.

Covers generate_lesson_plan() against AI mocks: complete-plan acceptance,
weak-cell repair, near-zero offline recovery on failing repairs, TIE
competence override, incomplete-AI fallback, and the AI prompt asking for
verbatim TIE competence statements. Scheme-of-work tests live in
``test_plan_generation_scheme.py``.
"""

from backend.services.teacher_plan_service import (
    _build_lesson_plan_prompt,
    generate_lesson_plan,
)


def _run(coro):
    import asyncio

    return asyncio.run(coro)


def _async_return(value):
    async def _fake(*args, **kwargs):
        return value

    return _fake


def _curriculum_ctx(*args, **kwargs):
    return "curriculum"


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
            }]
        },
    }


def _ai_plan_progression(overrides=None):
    stages = [
        {"stage": "Introduction", "time": "10 min",
         "teacher_activity": "Shows word cards and asks oral questions about unknown variables.",
         "learner_activity": "Observe the word cards and answer the oral questions.",
         "assessment_criteria": "Observe whether students, guided by your word-card prompt, identify the unknown variable correctly."},
        {"stage": "Competence Development", "time": "20 min",
         "teacher_activity": "Guides groups to convert scenarios into equations.",
         "learner_activity": "In groups, convert scenarios into equations and solve them.",
         "assessment_criteria": "Check that students, guided by your demonstration, successfully convert the scenarios into equations."},
        {"stage": "Design", "time": "5 min",
         "teacher_activity": "Assigns individual contextual problems and asks students to write their own word problems.",
         "learner_activity": "Formulate individual word problems for a peer to solve.",
         "assessment_criteria": "Verify that students formulate a correct word problem and solve the peer-given one."},
        {"stage": "Realizations", "time": "5 min",
         "teacher_activity": "Guides summary and gives exit ticket questions.",
         "learner_activity": "Complete exit ticket questions individually.",
         "assessment_criteria": "Verify that students complete the exit ticket questions correctly and independently."},
    ]
    for idx, patch in (overrides or {}).items():
        stages[idx].update(patch)
    return {
        "header": {"school_name": "AI School", "teacher_name": "AI Teacher", "class_name": "Form 2"},
        "competence_architecture": {
            "main_competence": "Main", "specific_competence": "Spec",
            "main_learning_activity": "MLA", "specific_learning_activity": "SLA",
            "lesson_objective": "Obj",
        },
        "resources_strategies": {"resources": [], "strategies": []},
        "progression_matrix": stages,
        "evaluation_learners": [], "evaluation_teacher": [], "remarks": "",
    }


def _plan_ai(monkeypatch, *patches):
    for attr, fn in patches:
        monkeypatch.setattr(f"backend.services.teacher_plans.{attr}", fn)


def test_lesson_plan_ai_keeps_strong_stage_specific_criteria(monkeypatch):
    """Good, naturally-written AI Assessment Criteria survive: they are not
    clobbered by templates when they already evaluate the stage (actor-named,
    non-generic), matching the reference-library quality teachers expect."""
    ai_plan = {
        "header": {"school_name": "AI School", "teacher_name": "AI Teacher", "class_name": "Form 2"},
        "competence_architecture": {
            "main_competence": "Main", "specific_competence": "Spec",
            "main_learning_activity": "MLA", "specific_learning_activity": "SLA",
            "lesson_objective": "Obj",
        },
        "resources_strategies": {"resources": [], "strategies": []},
        "progression_matrix": [
            {"stage": "Introduction", "time": "10 min",
             "teacher_activity": "Shows word cards and asks oral questions about unknown variables.",
             "learner_activity": "Observe the word cards and answer the oral questions.",
             "assessment_criteria": "Learners recall unknown quantities from daily situations and state why variables matter."},
            {"stage": "Competence Development", "time": "20 min",
             "teacher_activity": "Guides groups to convert scenarios into equations.",
             "learner_activity": "In groups, convert scenarios into equations and solve them.",
             "assessment_criteria": "Learners correctly convert scenarios into equations and solve them accurately."},
            {"stage": "Design", "time": "5 min",
             "teacher_activity": "Assigns individual contextual problems and asks students to write their own word problems.",
             "learner_activity": "Formulate individual word problems for a peer to solve.",
             "assessment_criteria": "Learners formulate correct word problems and accurately solve a peer's problem."},
            {"stage": "Realizations", "time": "5 min",
             "teacher_activity": "Guides summary and gives exit ticket questions.",
             "learner_activity": "Complete exit ticket questions individually.",
             "assessment_criteria": "Learners complete the exit ticket correctly and state the key takeaway."},
        ],
        "evaluation_learners": [], "evaluation_teacher": [], "remarks": "",
    }
    _plan_ai(monkeypatch, (
        "service._call_ai_service", _async_return(ai_plan),
    ), (
        "service.get_curriculum_context", _curriculum_ctx,
    ), (
        "offline.fetch_reference_grounding", lambda *a, **k: None,
    ))
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    matrix = plan["progression_matrix"]
    assert matrix[0]["assessment_criteria"] == (
        "Learners recall unknown quantities from daily situations and state why variables matter."
    )
    assert matrix[3]["assessment_criteria"] == (
        "Learners complete the exit ticket correctly and state the key takeaway."
    )
    criteria = [r["assessment_criteria"] for r in matrix]
    assert len(set(criteria)) == 4, "each stage keeps its own unique criterion"
    # TIE time weights: Introduction 5 / CD 15 / Design 12 / Realizations 8.
    assert [r["time"] for r in matrix] == ["5 min", "15 min", "12 min", "8 min"]


def test_lesson_plan_ai_repairs_weak_cells(monkeypatch):
    """When the AI's first attempt has broken progression cells, it is asked to
    repair precisely those cells before the plan is accepted."""
    weak = _ai_plan_progression({0: {"teacher_activity": "", "assessment_criteria": "Students will learn the topic."}})
    fixed = _ai_plan_progression()
    calls = {"n": 0}

    async def _fake(ep, payload):
        calls["n"] += 1
        return weak if calls["n"] == 1 else fixed

    _plan_ai(monkeypatch, (
        "service._call_ai_service", _fake,
    ), (
        "service.get_curriculum_context", _curriculum_ctx,
    ), (
        "offline.fetch_reference_grounding", lambda *a, **k: None,
    ))
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    assert calls["n"] == 2, "expected one initial call plus one repair round"
    assert plan["header"]["school_name"] == "AI School"
    assert plan["progression_matrix"][0]["teacher_activity"].startswith("Shows word cards")
    assert "students will learn" not in plan["progression_matrix"][0]["assessment_criteria"].lower()


def test_lesson_plan_ai_failing_repairs_use_near_zero_offline_recovery(monkeypatch):
    """If the AI cannot fix its progression table after the allowed repair
    rounds, only the progression matrix is rebuilt from the deterministic
    builder; the rest of the AI plan (header, competences) is preserved."""
    broken = _ai_plan_progression({
        0: {"teacher_activity": "", "learner_activity": "", "assessment_criteria": "Students will learn the topic."},
        1: {"teacher_activity": "", "learner_activity": "", "assessment_criteria": "Students will learn the topic."},
        2: {"teacher_activity": "", "learner_activity": "", "assessment_criteria": "Students will learn the topic."},
        3: {"teacher_activity": "", "learner_activity": "", "assessment_criteria": "Students will learn the topic."},
    })
    _plan_ai(monkeypatch, (
        "service._call_ai_service", _async_return(broken),
    ), (
        "service.get_curriculum_context", _curriculum_ctx,
    ), (
        "offline.fetch_reference_grounding", lambda *a, **k: None,
    ))
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    matrix = plan["progression_matrix"]
    assert plan["header"]["school_name"] == "AI School"
    assert [r["stage"] for r in matrix] == [
        "Introduction", "Competence Development", "Design", "Realizations"]
    for row in matrix:
        assert len(row["teacher_activity"]) >= 30, row["teacher_activity"]
        assert len(row["learner_activity"]) >= 30, row["learner_activity"]
        assert len(row["assessment_criteria"]) >= 30, row["assessment_criteria"]


def test_lesson_plan_ai_assessment_grounded_by_reference(monkeypatch):
    """An AI plan's generic Assessment Criteria are replaced with the reference
    library's per-stage text when a matching topic reference exists."""
    ai_plan = {
        "header": {"school_name": "AI School", "teacher_name": "AI Teacher", "class_name": "Form 2"},
        "competence_architecture": {
            "main_competence": "Main", "specific_competence": "Spec",
            "main_learning_activity": "MLA", "specific_learning_activity": "SLA",
            "lesson_objective": "Obj",
        },
        "resources_strategies": {"resources": [], "strategies": []},
        "progression_matrix": [
            {"stage": "Introduction", "time": "10 min",
             "teacher_activity": "Shows word cards and asks oral questions about unknown variables.",
             "learner_activity": "Observe the word cards and answer the oral questions.",
             "assessment_criteria": "Observe whether students identify the unknown variable from the word cards correctly."},
            {"stage": "Competence Development", "time": "20 min",
             "teacher_activity": "Guides groups to convert scenarios into equations.",
             "learner_activity": "In groups, convert scenarios into equations and solve them.",
             "assessment_criteria": "Check that students, guided by your demonstration, convert scenarios into equations."},
            {"stage": "Design", "time": "5 min",
             "teacher_activity": "Assigns individual contextual problems and asks students to write their own word problems.",
             "learner_activity": "Formulate individual word problems for a peer to solve.",
             "assessment_criteria": "Verify that students formulate their own word problem and solve the peer's."},
            {"stage": "Realizations", "time": "5 min",
             "teacher_activity": "Guides summary and gives exit ticket questions.",
             "learner_activity": "Complete exit ticket questions individually.",
             "assessment_criteria": "Verify that students complete exit ticket questions correctly."},
        ],
        "evaluation_learners": [], "evaluation_teacher": [], "remarks": "",
    }
    _plan_ai(monkeypatch, (
        "service._call_ai_service", _async_return(ai_plan),
    ), (
        "service.get_curriculum_context", _curriculum_ctx,
    ), (
        "offline.fetch_reference_grounding", _ref_grounding,
    ), (
        "competences.fetch_reference_grounding", _ref_grounding,
    ))
    plan = _run(generate_lesson_plan(
        subject_slug="mathematics", form_level=2, topic="Algebra",
        subtopic="Linear Equations", school_name="X", teacher_name="Y",
    ))
    matrix = plan["progression_matrix"]
    assert matrix[2]["assessment_criteria"] == "Students model word problems as equations with variables"
    assert matrix[3]["assessment_criteria"] == "Students present and justify their solutions to the class"
    assert matrix[0]["assessment_criteria"] == "Students recall algebraic terms from prior knowledge"


def test_lesson_plan_prompt_asks_for_verbatim_tie_competence():
    """The AI prompt instructs the model to copy the REAL TIE competence
    statements verbatim; the topic/subtopic TITLES never fill the competence
    fields."""
    prompt = _build_lesson_plan_prompt(
        lang="en",
        curriculum_ctx=_curriculum_ctx(),
        subject_label="Chemistry",
        subject_slug="chemistry",
        form_level=2,
        topic="Atomic Structure",
        subtopic="Atomic models",
        school_name="School",
        teacher_name="Teacher",
        number_of_students=40,
        duration_minutes=40,
        period="Period 1",
    )
    assert ("main_competence = 1.0 Demonstrate mastery of basic concepts, "
            "theories and principles in Chemistry") in prompt
    assert ("specific_competence = 1.1 Demonstrate mastery of concepts, "
            "theories and principles in Chemistry") in prompt
    assert "# Atomic Structure" not in prompt
    assert "# Atomic models" not in prompt
    assert "NEVER the topic title" in prompt