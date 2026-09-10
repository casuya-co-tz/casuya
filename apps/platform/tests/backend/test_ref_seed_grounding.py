"""Tests for reference-library grounding term/week selection.

Covers verified bundle seeding had to happen first (scheme and lesson
grounding), the Form One / Form Two Geography term rows, the exact educator-
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

    term_one = fetch_reference_grounding("geography", 1, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert rows
    first = rows[0]
    assert first["topic"] == "Introduction to Geography"
    assert first["main_competence"] == "1.0 Demonstrate mastery of foundational geographical concepts"
    assert first["main_activity"] == "Explain the concept of Geography"
    assert "Interactive lecture" in first["methods"]
    assert first["assessment"] == "Observation, Oral Questions, Portfolio"
    midterms = [r for r in rows if r["non_teaching"]]
    assert len(midterms) == 2
    assert midterms[0]["topic"] == "Mid-Term Assessment"

    term_two = fetch_reference_grounding("geography", 1, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    assert gl_two["rows"][0]["topic"] == "Weather and Climate"
    assert gl_two["rows"][0]["specific_competence"].startswith("3.1")


def test_scheme_grounding_form_two_selects_verified_term_rows():
    """Geography Form Two term selection resolves to the bundled verified Term
    I (internal/external Earth structure) and Term II (map & photograph reading)
    schemes, with the educator's strategies, resources and assessment tools
    carried verbatim into the normalized rows."""
    _seed_bundled()

    term_one = fetch_reference_grounding("geography", 2, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert len(rows) == 19  # 17 teaching + mid-term + terminal
    first = rows[0]
    assert first["topic"] == "The Internal Structure of the Earth"
    assert first["main_competence"] == "1.0 Demonstrate mastery of the Earth's internal structure and landform processes"
    assert first["specific_competence"].startswith("1.1 Describe the layers")
    assert first["main_activity"] == "Explain the concept of the internal structure of the Earth"
    assert first["specific_activity"] == "Describe the Crust, Mantle, and Core (3 lessons)"
    assert first["periods"] == "3"
    assert "group reading of TIE textbook" in first["methods"]
    assert first["assessment"] == "Diagram labeling, Oral questions"
    assert "globe" in first["resources"]
    non = [r for r in rows if r["non_teaching"]]
    assert len(non) == 2
    assert non[0]["topic"] == "Mid-Term Assessment"
    assert non[1]["topic"] == "Terminal Examination"

    term_two = fetch_reference_grounding("geography", 2, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    head = gl_two["rows"][0]
    assert head["topic"] == "Map Reading and Interpretation"
    assert head["specific_competence"] == "3.1 Apply essential elements and characteristics of good maps"
    assert head["assessment"] == "Element audit checklist, Oral quiz"
    assert any(r["topic"] == "Photograph Reading and Interpretation" for r in gl_two["rows"])
    assert len([r for r in gl_two["rows"] if r["non_teaching"]]) == 3


def test_fetch_grounding_selects_verified_bundled_lesson():
    """Grounding for the 'Concept of Geography' topic resolves to the exact
    bundled lesson 1.1 (title match beats chapter content matches), and its
    four-stage progression is extracted with a positive match flag."""
    _seed_bundled()

    ground = fetch_reference_grounding("geography", 1, "Concept of Geography", "lesson_plan")
    assert ground is not None
    assert "1.1: CONCEPT OF GEOGRAPHY" in ground["title"]
    assert ground["source_id"].startswith("bundled:")

    gl = lesson_plan_grounding(ground["content"], match_hint="Concept of Geography")
    assert gl["matched"] is True
    assert gl["main_competence"] == "1.0 Demonstrate mastery of foundational geographical concepts"
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["teacher_activity"].startswith(
        "Asks learners to describe what they see")
    assert gl["progression"][0]["learner_activity"].startswith(
        "List physical features and human activities observed")
    assert gl["progression"][1]["assessment_criteria"].startswith(
        "Learners define Geography accurately")


def test_fetch_grounding_selects_verified_bundled_form_two_lesson():
    """Grounding for a Form Two topic resolves to the exact bundled educator
    lesson (e.g. lesson 1 'Internal Structure of the Earth'), and the review
    and human-geography lessons (41, 80) are also reachable in the bundle."""
    _seed_bundled()

    ground = fetch_reference_grounding("geography", 2, "Internal Structure of the Earth", "lesson_plan")
    assert ground is not None
    assert "NO. 1" in ground["title"]
    assert ground["source_id"].startswith("bundled:")
    assert ground["standard"] == "Form 2"

    gl = lesson_plan_grounding(ground["content"], match_hint="Internal Structure of the Earth")
    assert gl["matched"] is True
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["stage"].lower() == "introduction"
    assert "egg" in gl["progression"][0]["teacher_activity"].lower()

    human = fetch_reference_grounding("geography", 2, "Introduction to Human Activities", "lesson_plan")
    assert human is not None
    assert "NO. 41" in human["title"]

    review = fetch_reference_grounding("geography", 2, "Comprehensive Review of Form Two Geography", "lesson_plan")
    assert review is not None
    assert "NO. 80" in review["title"]
    nonmatch = fetch_reference_grounding("geography", 2, "Quantum Mechanics", "lesson_plan")
    if nonmatch is not None:
        assert lesson_plan_grounding(nonmatch["content"], match_hint="Quantum Mechanics")["matched"] is False


def test_fetch_grounding_no_match_stays_negative():
    """A topic with no bundled geography lesson is not matched, so generators
    never ground on an unrelated verified lesson."""
    _seed_bundled()

    ground = fetch_reference_grounding("geography", 1, "States of Matter", "lesson_plan")
    if ground is None:
        return
    gl = lesson_plan_grounding(ground["content"], match_hint="States of Matter")
    assert gl["matched"] is False