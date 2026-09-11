"""Tests for the offline lesson plan builder: the verified educator-authored
Physics Form One lesson is mirrored verbatim when its bundle is seeded.
"""

from backend.config.database import get_db
from backend.services.teacher_plan_service import _build_lesson_plan_offline


def test_lesson_plan_offline_uses_verified_physics_reference():
    """When the bundled educator-verified Physics Form One lessons are
    seeded, the offline generator mirrors the verified plan: authentic
    competence statements and the exact per-stage teacher/learner/assessment
    cells instead of the generic scaffold."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_lesson_plan_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        topic="Concept of Physics", subtopic="Concept of Physics",
        school_name="Moshi Sec", teacher_name="Mr M",
        number_of_students=40, duration_minutes=40, period="Period 1", lang="en",
    )
    matrix = plan["progression_matrix"]
    assert matrix[0]["stage"] == "Introduction"
    assert matrix[0]["teacher_activity"].startswith(
        "Asks students to name everyday objects that work using physics principles")
    assert matrix[1]["assessment_criteria"].startswith(
        "Correct understanding of Physics")
    arch = plan["competence_architecture"]
    assert arch["main_competence"].startswith(
        "1.0 Demonstrate mastery of the nature of Physics, measurement, and force")
    assert arch["specific_competence"].startswith("1.1 Explain the concept and scope of Physics")