"""Tests for the offline lesson plan builder: TIE competency echo, knowledge
base grounding, fallback without a knowledge base, and reference-grounded
assessment criteria.
"""

import sys
from pathlib import Path

from backend.services.teacher_plan_service import _build_lesson_plan_offline


def _seed_subject_dict(slug: str, form_level: int) -> dict:
    """Build a service-shape subject dict from the real NECTA_SYLLABUS seed.

    Mirrors the DB->dict conversion in syllabus_service (_topic_to_dict /
    _subtopic_to_dict): period totals map to estimated_periods and the seed's
    (description, cognitive_level, order) outcome tuples become dicts. Lets the
    offline scheme/lesson generators be tested against the authentic TIE data
    that seed_necta_syllabus.run() inserts rather than synthetic mocks.
    """
    seed_dir = Path(__file__).resolve().parents[2] / "database" / "seeds"
    if str(seed_dir) not in sys.path:
        sys.path.insert(0, str(seed_dir))
    from seed_necta_syllabus import NECTA_SYLLABUS

    subject = next(s for s in NECTA_SYLLABUS if s["slug"] == slug)
    topics = []
    for t in sorted(
        (x for x in subject["topics"] if x["form_level"] == form_level),
        key=lambda x: x.get("order", 0),
    ):
        subtopics = []
        for sp in t.get("subtopics", []):
            outcomes = []
            for i, o in enumerate(sp.get("outcomes", []), start=1):
                if isinstance(o, (list, tuple)):
                    desc, cog, order = o
                    outcomes.append({
                        "description": desc,
                        "cognitive_level": cog,
                        "order_index": order if order else i,
                    })
                else:
                    outcomes.append({
                        "description": o.get("description", ""),
                        "cognitive_level": o.get("cognitive_level", "comprehension"),
                        "order_index": i,
                    })
            outcomes.sort(key=lambda x: x["order_index"])
            subtopics.append({
                "title": sp["title"],
                "code": sp.get("code"),
                "order_index": sp.get("order", 0),
                "estimated_periods": sp.get("periods") or 0,
                "outcomes": outcomes,
            })
        topics.append({
            "title": t["title"],
            "code": t.get("code"),
            "order_index": t.get("order", 0),
            "estimated_periods": t.get("periods") or 0,
            "form_level": form_level,
            "subtopics": subtopics,
        })
    return {
        "topics": topics,
        "name": subject["name"],
        "code": subject["code"],
        "slug": subject["slug"],
        "necta_code": subject["necta_code"],
    }


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


def _suppress_reference_grounding(monkeypatch):
    """These tests assert scaffold/knowledge-base behavior (not verified
    reference grounding); suppress the seeded bundles and TIE syllabus so they
    can't win."""
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


def test_lesson_plan_tie_specific_activity_and_assessment_echo(monkeypatch):
    """The offline lesson plan matches the official TIE format: a concise (non
    time-boxed) specific learning activity, the 4 official stage names ending in
    'Realizations', and a UNIQUE, learner-focused assessment criterion per stage
    built from that stage's own Learner Activity."""
    _suppress_reference_grounding(monkeypatch)
    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.get_subject_with_form",
        lambda slug, form: form_data,
    )

    topic = next(t for t in form_data["topics"] if t["subtopics"])
    subtopic = topic["subtopics"][0]
    plan = _build_lesson_plan_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        topic=topic["title"], subtopic=subtopic["title"], school_name="School",
        teacher_name="Teacher", number_of_students=40, duration_minutes=40,
        period="Period 1", lang="en",
    )
    ca = plan["competence_architecture"]
    # Competences carry the syllabus codes (TIE "{code} {title}" format).
    assert ca["main_competence"] == f"{topic['code']} {topic['title']}"
    assert ca["specific_competence"] == f"{subtopic['code']} {subtopic['title']}"
    # Specific activity is a concise (non time-boxed) outcome phrase.
    assert ca["specific_learning_activity"] and "minutes" not in ca["specific_learning_activity"].lower()
    # Official stage names, ending in "Realizations".
    stages = [r["stage"] for r in plan["progression_matrix"]]
    assert stages == ["Introduction", "Competence Development", "Design", "Realizations"]
    # Every stage has a UNIQUE criterion built from that stage's Learner
    # Activity (natural teacher-style wording, not a quoting template).
    evals = []
    for idx, row in enumerate(plan["progression_matrix"]):
        criteria = row["assessment_criteria"]
        evals.append(criteria)
        l_frag = " ".join(row["learner_activity"].split()[:6]).lower()
        assert l_frag in criteria.lower(), criteria
        assert "learners" in criteria.lower(), criteria
    assert len(set(evals)) == 4, "each stage must have a unique assessment criterion"


def test_lesson_plan_offline_uses_knowledge_base(monkeypatch):
    _suppress_reference_grounding(monkeypatch)
    knowledge_topics = [
        {
            "title": "Mechanics", "code": "1.0", "estimated_periods": 20,
            "description": "Understand force and motion",
            "subtopics": [
                {"title": "Kinematics", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe motion", "cognitive_level": "knowledge"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_lesson_plan_offline(
        subject_slug="physics", subject_label="Physics", form_level=3,
        topic="Mechanics", subtopic="Kinematics", school_name="School",
        teacher_name="Teacher", number_of_students=30, duration_minutes=40,
        period="Period 3", lang="en",
    )
    ca = plan["competence_architecture"]
    assert ca["main_competence"] == "1.0 Mechanics"
    assert ca["specific_competence"] == "1.1 Kinematics"
    assert "Understand force and motion" in ca["main_learning_activity"]
    assert "Describe motion" in ca["specific_learning_activity"]
    # Realizations stage is populated from the syllabus outcome.
    assert "Describe motion" in plan["progression_matrix"][3]["learner_activity"]

    from backend.services.teacher_plan_service import render_lesson_plan_html

    html = render_lesson_plan_html(plan)
    assert "1.1 Kinematics" in html
    assert "Describe motion" in html
    assert "Realizations" in html


def test_lesson_plan_offline_falls_back_without_knowledge_base(monkeypatch):
    _suppress_reference_grounding(monkeypatch)
    plan = _build_lesson_plan_offline(
        subject_slug="mathematics", subject_label="Mathematics", form_level=2,
        topic="Algebra", subtopic="Linear Equations", school_name="Mwanza Sec",
        teacher_name="Mr J", number_of_students=42, duration_minutes=40,
        period="Period 3", lang="en",
    )
    assert plan["competence_architecture"]["main_competence"].startswith(
        "Demonstrate mastery of algebraic")
    assert plan["progression_matrix"][3]["stage"] == "Realizations"


def test_lesson_plan_offline_grounds_assessment_with_reference(monkeypatch):
    """The offline lesson plan's Assessment Criteria column uses the reference
    library's authentic per-stage text instead of the generic echo phrases."""
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.fetch_reference_grounding",
        _ref_grounding,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.competences.fetch_reference_grounding",
        _ref_grounding,
    )
    plan = _build_lesson_plan_offline(
        subject_slug="mathematics", subject_label="Basic Mathematics",
        form_level=2, topic="INDICES AND LOGARITHMS", subtopic="Laws of Indices",
        school_name="School", teacher_name="Teacher", number_of_students=40,
        duration_minutes=40, period="Period 1", lang="en",
    )
    matrix = plan["progression_matrix"]
    assert matrix[0]["assessment_criteria"] == "Students recall algebraic terms from prior knowledge"
    assert matrix[1]["assessment_criteria"] == "Students solve linear equations accurately in pairs"
    assert matrix[3]["assessment_criteria"] == "Students present and justify their solutions to the class"