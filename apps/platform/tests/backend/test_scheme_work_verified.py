"""Tests for scheme of work generation (_build_scheme_offline): verified
educator-authored Geography rows (Form One / Two, Term I / II) are mirrored
verbatim when the bundled schemes are seeded.
"""

from backend.config.database import get_db
from backend.services.teacher_plan_service import _build_scheme_offline


def test_scheme_of_work_offline_uses_verified_geography_reference():
    """When the bundled educator-verified Geography Form One schemes are
    seeded, the offline Term I scheme reproduces the verified per-week rows
    verbatim: competences, strategies, resources and assessment tools."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="geography", subject_label="Geography", form_level=1,
        term="1", academic_year="2026", school_name="Moshi Sec",
        teacher_name="Mrs K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    assert any("MIDTERM EXAMINATION" == w["main_competence"] for w in weeks)
    week1 = next(w for w in weeks if w["learning_activities"] == ["Explain the concept of Geography"])
    assert week1["main_competence"] == "1.0 Demonstrate mastery of foundational geographical concepts"
    assert week1["specific_competence"].startswith("1.1 Define Geography")
    assert "Interactive lecture" in week1["teaching_methods"]
    assert any("guided discussion" in m.lower() for m in week1["teaching_methods"])
    assert week1["assessment_tools"] == "Observation, Oral Questions, Portfolio"
    assert any("Globe" in r for r in week1["teaching_resources"])
    assert week1["learning_activities"] == ["Explain the concept of Geography"]
    assert week1["specific_activities"] == [
        "Define Geography using Greek origins (Geo and Graphein) and describe its main focus"
    ]


def test_scheme_of_work_offline_term_two_uses_verified_rows():
    """Term II generation selects the verified Term 2 scheme (not Term 1):
    rows carry the Weather and Climate / Map Work content."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="geography", subject_label="Geography", form_level=1,
        term="2", academic_year="2026", school_name="Moshi Sec",
        teacher_name="Mrs K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    weather = next(w for w in weeks if "weather" in w["topic"].lower())
    assert weather["specific_competence"].startswith("3.1 Differentiate weather")
    assert weather["assessment_tools"] == "T-Chart Evaluation, Oral Questions"
    assert any("Daily weather observation" in m for m in weather["teaching_methods"])
    assert any("Map Work" == w["topic"] for w in weeks)


def test_scheme_of_work_offline_uses_verified_geography_form_two_reference():
    """When the bundled verified Geography Form Two schemes are seeded, the
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
        subject_slug="geography", subject_label="Geography", form_level=2,
        term="1", academic_year="2026", school_name="Arusha Sec",
        teacher_name="Mr K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    assert any("MIDTERM EXAMINATION" == w["main_competence"] for w in weeks)
    week1 = next(w for w in weeks if w["learning_activities"] == ["Explain the concept of the internal structure of the Earth"])
    assert week1["main_competence"] == "1.0 Demonstrate mastery of the Earth's internal structure and landform processes"
    assert week1["specific_competence"] == "1.1 Describe the layers of the Earth's interior and their characteristics"
    assert week1["periods"] == 3
    assert week1["specific_activities"] == ["Describe the Crust, Mantle, and Core (3 lessons)"]
    assert "group reading of TIE textbook" in week1["teaching_methods"]
    assert "Wall chart of Earth interior" in week1["teaching_resources"]
    assert week1["assessment_tools"] == "Diagram labeling, Oral questions"
    weathering = next(w for w in weeks if w["learning_activities"] == ["Explain weathering concepts and types"])
    assert weathering["periods"] == 4
    assert "Field walk around school compound to observe weathered rocks/buildings" in weathering["teaching_methods"]


def test_scheme_of_work_offline_geography_form_two_term_two_uses_verified_rows():
    """Form Two Term II generation selects the bundled Term 2 scheme: map and
    photograph reading rows, with no Term I (Earth structure) content."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    plan = _build_scheme_offline(
        subject_slug="geography", subject_label="Geography", form_level=2,
        term="2", academic_year="2026", school_name="Arusha Sec",
        teacher_name="Mr K", topics=[], lang="en",
    )
    weeks = plan["weeks"]
    maps_row = next(w for w in weeks if w["topic"] == "Map Reading and Interpretation")
    assert maps_row["specific_competence"] == "3.1 Apply essential elements and characteristics of good maps"
    assert maps_row["assessment_tools"] == "Element audit checklist, Oral quiz"
    photo = next(w for w in weeks if w["topic"] == "Photograph Reading and Interpretation")
    assert photo["specific_competence"].startswith("4.1 Classify")
    assert all("Internal Structure" not in w["topic"] for w in weeks)