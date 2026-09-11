"""Tests for reference-library grounding term/week selection.

Covers verified bundle seeding had to happen first (scheme and lesson
grounding), the Form One / Form Two Physics term rows, the exact educator-
authored lesson selection, and the negative (no-match) path.
"""

from backend.config.database import get_db
from backend.services.reference_library_service import (
    fetch_reference_grounding,
    lesson_plan_grounding,
    scheme_of_work_grounding,
)


def _seed_bundled():
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()


def test_scheme_grounding_selects_verified_term_rows():
    """Term selection resolves to the right bundled scheme, and its per-week
    rows carry the verified competences, strategies, resources, assessment
    tools and non-teaching placeholders in normalized form."""
    _seed_bundled()

    term_one = fetch_reference_grounding("physics", 1, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert rows
    first = rows[0]
    assert first["topic"] == "Introduction to Physics"
    assert first["main_competence"] == "1.0 Demonstrate mastery of the nature of Physics, measurement, and force"
    assert first["specific_competence"] == "1.1 Explain the concept and scope of Physics"
    assert first["main_activity"] == "Introduce Physics as a subject"
    assert "Class discussion" in first["methods"]
    assert first["assessment"] == "Oral questions"
    midterms = [r for r in rows if r["non_teaching"]]
    assert len(midterms) == 2
    assert midterms[0]["topic"] == "Mid-Term Assessment"

    term_two = fetch_reference_grounding("physics", 1, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    assert gl_two["rows"][0]["topic"] == "Mechanical Properties of Matter"
    assert gl_two["rows"][0]["specific_competence"].startswith("6.1")


def test_scheme_grounding_form_two_selects_verified_term_rows():
    """Physics Form Two term selection resolves to the bundled verified Term
    I (static/current electricity) and Term II (optics) schemes,
    with the educator's strategies, resources and assessment tools
    carried verbatim into the normalized rows."""
    _seed_bundled()

    term_one = fetch_reference_grounding("physics", 2, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert len(rows) == 17  # 15 teaching + mid-term + terminal
    first = rows[0]
    assert first["topic"] == "Static Electricity"
    assert first["main_competence"] == "1.0 Understand static electricity"
    assert first["specific_competence"] == "1.1 Identify charged materials"
    assert first["main_activity"] == "Identifying charges"
    assert first["specific_activity"] == "Identify charged materials using simple experiments"
    assert first["periods"] == "3"
    assert first["methods"] == ["Demonstration", "practical experiments"]
    assert first["assessment"] == "Observation test"
    non = [r for r in rows if r["non_teaching"]]
    assert len(non) == 2
    assert non[0]["topic"] == "Mid-Term Assessment"
    assert non[1]["topic"] == "Terminal Examination"

    term_two = fetch_reference_grounding("physics", 2, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    head = gl_two["rows"][0]
    assert head["topic"] == "Nature and Reflection of Light"
    assert head["specific_competence"] == "4.1 Explain the concept of light"
    assert head["assessment"] == "Oral questions"
    assert any(r["topic"] == "Optical Instruments" for r in gl_two["rows"])
    assert len([r for r in gl_two["rows"] if r["non_teaching"]]) == 2


def test_fetch_grounding_selects_verified_bundled_lesson():
    """Grounding for the 'Concept of Physics' topic resolves to the exact
    bundled lesson 1A (title match beats chapter content matches), and its
    four-stage progression is extracted with a positive match flag."""
    _seed_bundled()

    ground = fetch_reference_grounding("physics", 1, "Concept of Physics", "lesson_plan")
    assert ground is not None
    assert "CONCEPT OF PHYSICS" in ground["title"]
    assert ground["source_id"].startswith("bundled:")

    gl = lesson_plan_grounding(ground["content"], match_hint="branches")
    assert gl["matched"] is True
    assert gl["main_competence"] == "1.0 Demonstrate mastery of the nature of Physics, measurement, and force"
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["stage"] == "Introduction"
    assert gl["progression"][0]["teacher_activity"].startswith(
        "Asks students to name everyday objects")
    assert gl["progression"][1]["assessment_criteria"].startswith(
        "Correct understanding of Physics")


def test_fetch_grounding_selects_verified_bundled_form_two_lesson():
    """Grounding for a Form Two topic resolves to the exact bundled educator
    lesson (e.g. lesson 1 'Identifying Charged Materials'), and the magnetism
    lessons (11+) are also reachable in the bundle."""
    _seed_bundled()

    ground = fetch_reference_grounding("physics", 2, "Identifying Charged Materials", "lesson_plan")
    assert ground is not None
    assert "NO. 1" in ground["title"]
    assert ground["source_id"].startswith("bundled:")
    assert ground["standard"] == "Form 2"

    gl = lesson_plan_grounding(ground["content"], match_hint="static electricity")
    assert gl["matched"] is True
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["stage"].lower() == "introduction"
    assert "balloon" in gl["progression"][0]["teacher_activity"].lower()

    magnetic = fetch_reference_grounding("physics", 2, "Properties of Magnets", "lesson_plan")
    assert magnetic is not None
    assert "NO. 13" in magnetic["title"]

    nonmatch = fetch_reference_grounding("physics", 2, "Photosynthesis", "lesson_plan")
    if nonmatch is not None:
        assert lesson_plan_grounding(nonmatch["content"], match_hint="Photosynthesis")["matched"] is False


def test_fetch_grounding_no_match_stays_negative():
    """A topic with no bundled physics lesson is not matched, so generators
    never ground on an unrelated verified lesson."""
    _seed_bundled()

    ground = fetch_reference_grounding("physics", 1, "Organic Chemistry", "lesson_plan")
    if ground is None:
        return
    gl = lesson_plan_grounding(ground["content"], match_hint="Organic Chemistry")
    assert gl["matched"] is False
