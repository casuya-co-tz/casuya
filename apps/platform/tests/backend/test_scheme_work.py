"""Tests for scheme of work generation (_build_scheme_offline): offline HTML
render, third-term rejection, and midterm/period integrity against the real
TIE syllabus.
"""

import sys
from pathlib import Path

from backend.services.teacher_plan_service import (
    _build_scheme_offline,
    render_scheme_of_work_html,
)


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


def test_scheme_of_work_offline_render(monkeypatch):
    # Rendering tests don't exercise verified reference grounding; suppress it
    # so a seeded bundle or the TIE syllabus can't override the monkeypatched
    # knowledge topics.
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.fetch_reference_grounding",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.scheme_rows.ts_get_specific_competences",
        lambda *a, **k: [],
    )
    monkeypatch.setattr(
        "backend.services.teacher_plans.scheme_rows._tie_competences",
        lambda *a, **k: (None, None),
    )
    knowledge_topics = [
        {
            "title": "Mechanics", "code": "1.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "Kinematics", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe motion", "cognitive_level": "knowledge"}]},
                {"title": "Dynamics", "code": "1.2", "estimated_periods": 12,
                 "outcomes": [{"description": "Explain forces", "cognitive_level": "comprehension"}]},
            ],
        },
        {
            "title": "Waves", "code": "2.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "Sound Waves", "code": "2.1", "estimated_periods": 10,
                 "outcomes": [{"description": "Describe sound propagation", "cognitive_level": "knowledge"}]},
                {"title": "Light Waves", "code": "2.2", "estimated_periods": 10,
                 "outcomes": [{"description": "Apply reflection laws", "cognitive_level": "application"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=3,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["Mechanics", "Waves"], lang="en",
    )
    # weeks: 4 teaching + 2 midterm (exam + holiday) inserted at the midpoint.
    assert [w["specific_competence"] for w in plan["weeks"]] == [
        "1.1 Kinematics", "1.2 Dynamics",
        "Assess learner mastery of the Term's topics",
        "Learner break following the midterm examination",
        "2.1 Sound Waves", "2.2 Light Waves",
    ]
    assert plan["weeks"][0]["main_competence"] == "1.0 Mechanics"
    assert "Describe motion" in plan["weeks"][0]["learning_activities"]
    assert plan["weeks"][0]["periods"] == 8
    # Midterm weeks have periods=0 (non-teaching).
    assert plan["weeks"][2]["periods"] == 0
    assert plan["weeks"][3]["periods"] == 0
    # Teaching weeks retain authentic periods; midterm weeks do not inflate them.
    teaching = [w for w in plan["weeks"] if w["periods"] > 0]
    assert sum(w["periods"] for w in teaching) == 8 + 12 + 10 + 10
    # Term I: first 4 weeks = January, weeks 5-6 = February (4-week month blocks).
    assert [w["month"] for w in plan["weeks"][:4]] == ["January"] * 4
    assert [w["month"] for w in plan["weeks"][4:]] == ["February"] * 2

    html = render_scheme_of_work_html(plan)
    assert "Mechanics" in html
    assert "Kinematics" in html
    assert "Term 1" in html
    assert "downloadAsWord" in html
    assert "ORIENTATION COURSE" in html
    assert "Main competence" in html
    assert "Specific competence" in html
    assert "Learning Activities" in html
    assert "Specific activities" in html
    assert "Month" in html
    assert "Assessment tools" in html
    assert "Teaching and learning methods" in html
    assert "Teaching and learning resources" in html
    # The embedded Word exporter must build a single Word-suitable document
    # (no nested <html>/<body> inside another full document).
    assert "application/msword" in html
    assert "document.documentElement.outerHTML" not in html


def test_scheme_of_work_rejects_third_term():
    from backend.api.teacher_plans import SchemeOfWorkGenerateRequest
    import pytest

    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 1")
    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 2")
    with pytest.raises(ValueError):
        SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 3")


def test_scheme_of_work_midterm_and_period_integrity(monkeypatch):
    """Every term gets two non-teaching midterm weeks (exam + holiday) and
    the teaching-period total is never inflated by their insertion.

    Also asserts the data-integrity rule: every topic's period count must
    equal the sum of its subtopic periods — enforced at seed level and
    checked here as a regression guard.
    """
    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plans.offline.get_subject_with_form",
        lambda slug, form: form_data,
    )

    for term in ("Term 1", "Term 2"):
        plan = _build_scheme_offline(
            subject_slug="physics", subject_label="Physics", form_level=1,
            term=term, academic_year="2026", school_name="School",
            teacher_name="Teacher", topics=[], lang="en",
        )
        weeks = plan["weeks"]
        teaching  = [w for w in weeks if w["periods"] > 0]
        midterm   = [w for w in weeks if w["periods"] == 0]

        # Exactly two midterm weeks per term.
        assert len(midterm) == 2, f"{term}: expected 2 midterm weeks, got {len(midterm)}"
        assert midterm[0]["main_competence"] == "MIDTERM EXAMINATION"
        assert midterm[1]["main_competence"] == "MIDTERM HOLIDAY"

        # Week numbering must be continuous after midterm insertion.
        assert [w["week_number"] for w in weeks] == list(range(1, len(weeks) + 1))

        # Teaching-period total must equal the TIE syllabus period total.
        from backend.data.tie_syllabus import get_specific_competences as _ts_g
        sub_total = sum(
            int(s.get("number_of_periods") or 0)
            for s in _ts_g("physics", 1)
        )
        assert sum(w["periods"] for w in teaching) == sub_total

        # Month assignment: Term 1 = Jan-May, Term 2 = Jul-Nov.
        valid_months = (
            {"January", "February", "March", "April", "May"}
            if term == "Term 1"
            else {"July", "August", "September", "October", "November"}
        )
        assert {w["month"] for w in weeks} <= valid_months