"""Tests for scheme of work generation (_build_scheme_offline): verified
educator-authored Physics rows (Form One / Two, Term I / II) are mirrored
verbatim when the bundled schemes are seeded.
"""

from backend.config.database import get_db
from backend.services.teacher_plan_service import _build_scheme_offline


def test_scheme_of_work_offline_uses_verified_physics_reference():
    """When the bundled educator-verified Physics Form One schemes are
    seeded, the offline Term I scheme reproduces the verified per-week rows
    verbatim: competences, strategies, resources and assessment tools."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        term="1", academic_year="2026", school_name="Moshi Sec",
        teacher_name="Mrs K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    assert any("MIDTERM EXAMINATION" == w["main_competence"] for w in weeks)
    week1 = next(w for w in weeks if w["learning_activities"] == ["Introduce Physics as a subject"])
    assert week1["main_competence"] == "1.0 Demonstrate mastery of the nature of Physics, measurement, and force"
    assert week1["specific_competence"] == "1.1 Explain the concept and scope of Physics"
    assert "Class discussion" in week1["teaching_methods"]
    assert any("brainstorming" in m.lower() for m in week1["teaching_methods"])
    assert week1["assessment_tools"] == "Oral questions"
    assert "Physics textbook" in week1["teaching_resources"]
    assert week1["learning_activities"] == ["Introduce Physics as a subject"]
    assert week1["specific_activities"] == [
        "Explain the concept of Physics and its branches"
    ]
    assert week1["periods"] == 4


def test_scheme_of_work_offline_term_two_uses_verified_rows():
    """Term II generation selects the verified Term 2 scheme (not Term 1):
    rows carry the Mechanical Properties / Pressure / Linear Motion content."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        term="2", academic_year="2026", school_name="Moshi Sec",
        teacher_name="Mrs K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    mech = next(w for w in weeks if "mechanical" in w["topic"].lower())
    assert mech["specific_competence"].startswith("6.1 Explain the concept of elasticity")
    assert mech["assessment_tools"] == "Practical test"
    assert any("Spring stretching practical" in m for m in mech["teaching_methods"])
    assert any("pressure" in w["topic"].lower() for w in weeks)


def test_scheme_of_work_offline_uses_verified_physics_form_two_reference():
    """When the bundled verified Physics Form Two schemes are seeded, the
    offline Term I scheme reproduces the educator-verified per-week rows
    verbatim: competences, lesson-load periods, strategies, resources and
    assessment tools, plus the injected mid-term weeks."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=2,
        term="1", academic_year="2026", school_name="Arusha Sec",
        teacher_name="Mr K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    assert any("MIDTERM EXAMINATION" == w["main_competence"] for w in weeks)
    week1 = next(w for w in weeks if w["learning_activities"] == ["Identifying charges"])
    assert week1["main_competence"] == "1.0 Understand static electricity"
    assert week1["specific_competence"] == "1.1 Identify charged materials"
    assert week1["periods"] == 3
    assert week1["specific_activities"] == ["Identify charged materials using simple experiments"]
    assert "Demonstration" in week1["teaching_methods"]
    assert "Ebonite rod" in week1["teaching_resources"]
    assert week1["assessment_tools"] == "Observation test"
    current = next(w for w in weeks if w["learning_activities"] == ["Effects of electric current"])
    assert current["specific_competence"] == "2.1 Identify effects of electric current"


def test_scheme_of_work_offline_physics_form_two_term_two_uses_verified_rows():
    """Form Two Term II generation selects the bundled Term 2 scheme: optics
    rows, with no Term I (electricity) content."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=2,
        term="2", academic_year="2026", school_name="Arusha Sec",
        teacher_name="Mr K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    light_row = next(w for w in weeks if w["topic"] == "Nature and Reflection of Light")
    assert light_row["specific_competence"] == "4.1 Explain the concept of light"
    assert light_row["assessment_tools"] == "Oral questions"
    optical = next(w for w in weeks if w["topic"] == "Optical Instruments")
    assert optical["specific_competence"].startswith("6.1")
    assert all("Static Electricity" not in w["topic"] for w in weeks)