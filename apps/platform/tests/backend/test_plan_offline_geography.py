"""Tests for the offline lesson plan builder: the verified educator-authored
Geography Form One lesson is mirrored verbatim when its bundle is seeded.
"""

from backend.config.database import get_db
from backend.services.teacher_plan_service import _build_lesson_plan_offline


def test_lesson_plan_offline_uses_verified_geography_reference():
    """When the bundled educator-verified Geography Form One lessons are
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
        subject_slug="geography", subject_label="Geography", form_level=1,
        topic="Concept of Geography", subtopic="Concept of Geography",
        school_name="Moshi Sec", teacher_name="Mr M",
        number_of_students=40, duration_minutes=40, period="Period 1", lang="en",
    )
    matrix = plan["progression_matrix"]
    assert matrix[0]["teacher_activity"].startswith(
        "Asks learners to describe what they see around their school environment")
    assert matrix[0]["learner_activity"].startswith(
        "List physical features and human activities observed in their surroundings")
    assert matrix[1]["teacher_activity"].startswith(
        "Explains the origin of the word Geography")
    assert matrix[1]["assessment_criteria"].startswith(
        "Learners define Geography accurately using its Greek root words")
    assert matrix[3]["stage"] == "Realizations"
    arch = plan["competence_architecture"]
    assert arch["main_competence"].startswith(
        "1.0 Demonstrate mastery of foundational geographical concepts")
    assert arch["specific_competence"].startswith("1.1 Define Geography")