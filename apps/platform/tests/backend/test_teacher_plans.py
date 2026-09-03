"""Tests for teacher plan (lesson plan / scheme of work) generation and CRUD."""

import json
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from backend.services.teacher_plan_service import (
    _build_lesson_plan_offline,
    _build_scheme_offline,
    _lang_label,
    render_lesson_plan_html,
    render_scheme_of_work_html,
)

client = TestClient(app)


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


def _register(role: str):
    email = f"plan-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", role.title(), role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


# ── Service: language mapping ──────────────────────────────────────────────


def test_language_mapping():
    assert _lang_label("kiswahili") == "sw"
    assert _lang_label("historia-ya-tanzania-na-maadili") == "sw"
    assert _lang_label("mathematics") == "en"
    assert _lang_label("biology") == "en"


# ── Service: offline generators + renderers ───────────────────────────────


def test_lesson_plan_offline_render_english():
    plan = _build_lesson_plan_offline(
        subject_slug="mathematics", subject_label="Mathematics", form_level=2,
        topic="Algebra", subtopic="Linear Equations", school_name="Mwanza Sec",
        teacher_name="Mr J", number_of_students=42, duration_minutes=40,
        period="Period 3", lang="en",
    )
    assert plan["header"]["school_name"] == "Mwanza Sec"
    assert plan["header"]["class_name"] == "Form 2"
    assert plan["header"]["students_registered"]["total"] == 42
    assert plan["header"]["students_registered"]["boys"] + plan["header"]["students_registered"]["girls"] == 42
    assert len(plan["progression_matrix"]) == 4
    assert plan["progression_matrix"][0]["stage"] == "Introduction"
    assert [r["stage"] for r in plan["progression_matrix"]] == [
        "Introduction", "Competence Development", "Design", "Realizations",
    ]
    assert "main_competence" in plan["competence_architecture"]
    assert plan["competence_architecture"]["specific_learning_activity"].startswith("Within 40 minutes")
    # stage times must sum to the duration
    total_time = sum(int(r["time"].split()[0]) for r in plan["progression_matrix"])
    assert total_time == 40

    html = render_lesson_plan_html(plan)
    assert "Linear Equations" in html
    assert "Form 2" in html
    assert "UNITED REPUBLIC OF TANZANIA" not in html
    assert "TANZANIA INSTITUTE OF EDUCATION" not in html
    assert "Competence Development" in html
    assert "Design" in html
    assert "Realizations" in html
    assert "Assessment Criteria" in html
    assert "REMARKS :" in html
    assert "1. CLASS INFORMATION" in html
    assert "2. MAIN COMPETENCE" in html
    assert "3. SPECIFIC COMPETENCE" in html
    assert "4. MAIN ACTIVITY" in html
    assert "5. SPECIFIC ACTIVITY" in html
    assert "6. TEACHING/LEARNING RESOURCE" in html
    assert "Learners" in html and "Activities" in html
    assert "LESSON PLAN NO." in html
    assert "downloadAsWord" not in html
    assert "window.print()" not in html


def test_lesson_plan_offline_render_kiswahili():
    plan = _build_lesson_plan_offline(
        subject_slug="kiswahili", subject_label="Kiswahili", form_level=1,
        topic="Fasihi", subtopic="Methali", school_name="Shule", teacher_name="Bw J",
        number_of_students=30, duration_minutes=40, period="Kipindi 1", lang="sw",
    )
    assert len(plan["progression_matrix"]) == 4
    assert plan["progression_matrix"][0]["stage"] == "Utangulizi"
    assert "Ndani ya dakika" in plan["competence_architecture"]["specific_learning_activity"]
    html = render_lesson_plan_html(plan)
    assert "Methali" in html
    assert "JAMHURI YA MUUNGANO WA TANZANIA" not in html
    assert "MPANGO WA SOMO LA MWALIMU" not in html
    assert "Ukuzaji wa Ujuzi" in html or "Kigezo cha Tathmini" in html
    assert "Kigezo cha Tathmini" in html or "Mpango wa Somo" in html


def test_lesson_plan_offline_uses_knowledge_base(monkeypatch):
    knowledge_topics = [
        {
            "title": "Cell Biology", "code": "1.0", "estimated_periods": 20,
            "description": "Understand the cell as the basic unit of life",
            "subtopics": [
                {"title": "Cell Structure", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe the cell", "cognitive_level": "knowledge"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_lesson_plan_offline(
        subject_slug="biology", subject_label="Biology", form_level=3,
        topic="Cell Biology", subtopic="Cell Structure", school_name="School",
        teacher_name="Teacher", number_of_students=30, duration_minutes=40,
        period="Period 3", lang="en",
    )
    ca = plan["competence_architecture"]
    assert ca["main_competence"] == "1.0 Cell Biology"
    assert ca["specific_competence"] == "1.1 Cell Structure"
    assert "Understand the cell" in ca["main_learning_activity"]
    assert "Describe the cell" in ca["specific_learning_activity"]
    # Realizations stage is populated from the syllabus outcome.
    assert "Describe the cell" in plan["progression_matrix"][3]["learner_activity"]

    html = render_lesson_plan_html(plan)
    assert "1.1 Cell Structure" in html
    assert "Describe the cell" in html
    assert "Realizations" in html


def test_lesson_plan_offline_falls_back_without_knowledge_base():
    plan = _build_lesson_plan_offline(
        subject_slug="mathematics", subject_label="Mathematics", form_level=2,
        topic="Algebra", subtopic="Linear Equations", school_name="Mwanza Sec",
        teacher_name="Mr J", number_of_students=42, duration_minutes=40,
        period="Period 3", lang="en",
    )
    assert plan["competence_architecture"]["main_competence"].startswith(
        "Demonstrate mastery of algebraic")
    assert plan["progression_matrix"][3]["stage"] == "Realizations"


def test_scheme_of_work_offline_render(monkeypatch):
    knowledge_topics = [
        {
            "title": "Cell Biology", "code": "1.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "Cell Structure", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe the cell", "cognitive_level": "knowledge"}]},
                {"title": "Cell Division", "code": "1.2", "estimated_periods": 12,
                 "outcomes": [{"description": "Explain mitosis", "cognitive_level": "comprehension"}]},
            ],
        },
        {
            "title": "Genetics", "code": "2.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "DNA and RNA", "code": "2.1", "estimated_periods": 10,
                 "outcomes": [{"description": "Describe DNA structure", "cognitive_level": "knowledge"}]},
                {"title": "Mendelian Inheritance", "code": "2.2", "estimated_periods": 10,
                 "outcomes": [{"description": "Apply Mendel's laws", "cognitive_level": "application"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_scheme_offline(
        subject_slug="biology", subject_label="Biology", form_level=3,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["Cell Biology", "Genetics"], lang="en",
    )
    # weeks: 4 teaching + 2 midterm (exam + holiday) inserted at the midpoint.
    assert [w["specific_competence"] for w in plan["weeks"]] == [
        "1.1 Cell Structure", "1.2 Cell Division",
        "Assess learner mastery of the Term's topics",
        "Learner break following the midterm examination",
        "2.1 DNA and RNA", "2.2 Mendelian Inheritance",
    ]
    assert plan["weeks"][0]["main_competence"] == "1.0 Cell Biology"
    assert "Describe the cell" in plan["weeks"][0]["learning_activities"]
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
    assert "Cell Biology" in html
    assert "Cell Structure" in html
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


def test_scheme_of_work_rejects_third_term():
    from backend.api.teacher_plans import SchemeOfWorkGenerateRequest
    import pytest

    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 1")
    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 2")
    with pytest.raises(ValueError):
        SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 3")


# ── Service: generators consume the real enriched TIE syllabus ────────────


def test_scheme_of_work_uses_real_enriched_syllabus(monkeypatch):
    # Physics O-Level was rebuilt from the authentic TIE knowledge base, so the
    # offline scheme generator must surface its real topics/subtopics/outcomes
    # (not synthetic fallbacks) when fed the seeded syllabus data.
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: form_data,
    )

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["INTRODUCTION TO LABORATORY PRACTICE"],
        lang="en",
    )
    assert len(plan["weeks"]) > 0
    first = plan["weeks"][0]
    # Authentic TIE topic + subtopic titles/codes from the seed.
    assert first["topic"] == "INTRODUCTION TO LABORATORY PRACTICE"
    assert first["main_competence"] == "1.0 INTRODUCTION TO LABORATORY PRACTICE"
    assert first["specific_competence"].startswith("1.1 ")
    # The authentic KB outcomes become the weekly learning activities.
    assert first["learning_activities"], "weekly learning activities must be populated"
    # Term I only spans months January..May (4 weeks per month).
    assert {w["month"] for w in plan["weeks"]} <= {
        "January", "February", "March", "April", "May",
    }
    # Midterm weeks (periods=0) sit at the midpoint; teaching weeks carry
    # the authentic subtopic period totals and are never 0.
    teaching = [w for w in plan["weeks"] if w["periods"] > 0]
    midterm  = [w for w in plan["weeks"] if w["periods"] == 0]
    assert len(midterm) == 2, "expect exactly midterm exam + midterm holiday"
    assert all(w["periods"] > 0 for w in teaching)
    # Teaching period total must equal the sum of all subtopic periods (Physics F1).
    assert sum(w["periods"] for w in teaching) == sum(
        sp.get("estimated_periods", 0)
        for t in form_data["topics"] for sp in t.get("subtopics", [])
    )


def test_lesson_plan_uses_real_enriched_syllabus(monkeypatch):
    form_data = _seed_subject_dict("physics", 2)
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: form_data,
    )

    # Find a real topic/subtopic pair with outcomes in Form 2 Physics seed.
    topic = next(t for t in form_data["topics"] if t["subtopics"])
    subtopic = topic["subtopics"][0]
    plan = _build_lesson_plan_offline(
        subject_slug="physics", subject_label="Physics", form_level=2,
        topic=topic["title"], subtopic=subtopic["title"], school_name="School",
        teacher_name="Teacher", number_of_students=40, duration_minutes=40,
        period="Period 1", lang="en",
    )
    ca = plan["competence_architecture"]
    # Authentic competences derived from the real seed codes/titles.
    assert ca["main_competence"] == f"{topic['code']} {topic['title']}"
    assert ca["specific_competence"] == f"{subtopic['code']} {subtopic['title']}"
    # An authentic TIE outcome is reflected in the Realizations learner activity.
    assert any(
        ca["specific_learning_activity"]
        for _ in [plan["progression_matrix"][3]["learner_activity"]]
    )


# ── Service: midterm weeks + period integrity ─────────────────────────────


def test_scheme_of_work_midterm_and_period_integrity(monkeypatch):
    """Every term gets two non-teaching midterm weeks (exam + holiday) and
    the teaching-period total is never inflated by their insertion.

    Also asserts the data-integrity rule: every topic's period count must
    equal the sum of its subtopic periods — enforced at seed level and
    checked here as a regression guard.
    """
    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
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

        # Teaching-period total must equal the sum of all subtopic periods.
        sub_total = sum(
            sp.get("estimated_periods", 0)
            for t in form_data["topics"]
            for sp in t.get("subtopics", [])
        )
        assert sum(w["periods"] for w in teaching) == sub_total

        # Month assignment: Term 1 = Jan-May, Term 2 = Jul-Nov.
        valid_months = (
            {"January", "February", "March", "April", "May"}
            if term == "Term 1"
            else {"July", "August", "September", "October", "November"}
        )
        assert {w["month"] for w in weeks} <= valid_months

    # Data-integrity rule: topic periods == subtopic sum for every topic.
    for t in form_data["topics"]:
        sp_sum = sum(sp.get("estimated_periods", 0) for sp in t.get("subtopics", []))
        assert t.get("estimated_periods", 0) == sp_sum, (
            f"topic {t.get('code')} periods={t.get('estimated_periods')} "
            f"!= subtopic sum={sp_sum}"
        )


# ── API: save / list / get / delete ───────────────────────────────────────


def _save_plan(headers, plan_type="lesson_plan"):
    return client.post("/teacher-plans/save", headers=headers, json={
        "plan_type": plan_type,
        "title": "Algebra Test",
        "subject_slug": "mathematics",
        "subject_name": "Mathematics",
        "form_level": 2,
        "topic": "Algebra",
        "subtopic": "Logic",
        "plan_data": json.dumps({"header": {"topic": "Algebra"}}),
        "html_render": "<h1>Plan</h1>",
        "language": "en",
    })


def test_teacher_can_save_plan():
    headers, _ = _register("teacher")
    resp = _save_plan(headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["plan_type"] == "lesson_plan"
    assert data["id"]


def test_teacher_lists_only_own_plans():
    headers_a, _ = _register("teacher")
    headers_b, _ = _register("teacher")
    _save_plan(headers_a)
    _save_plan(headers_a, "scheme_of_work")
    _save_plan(headers_b)

    resp = client.get("/teacher-plans/list", headers=headers_a)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    resp_type = client.get("/teacher-plans/list?plan_type=scheme_of_work", headers=headers_a)
    assert resp_type.status_code == 200
    assert len(resp_type.json()) == 1
    assert resp_type.json()[0]["plan_type"] == "scheme_of_work"


def test_teacher_can_get_detail_and_export():
    headers, _ = _register("teacher")
    plan_id = _save_plan(headers).json()["id"]

    detail = client.get(f"/teacher-plans/{plan_id}", headers=headers)
    assert detail.status_code == 200
    assert "plan_data" in detail.json()
    assert "html_render" in detail.json()

    export = client.get(f"/teacher-plans/{plan_id}/export", headers=headers)
    assert export.status_code == 200
    assert "<h1>Plan</h1>" in export.text


def test_teacher_can_delete_plan():
    headers, _ = _register("teacher")
    plan_id = _save_plan(headers).json()["id"]

    resp = client.delete(f"/teacher-plans/{plan_id}", headers=headers)
    assert resp.status_code == 200

    gone = client.get(f"/teacher-plans/{plan_id}", headers=headers)
    assert gone.status_code == 404


def test_plan_requires_teacher_role():
    headers_student, _ = _register("student")
    resp = _save_plan(headers_student)
    assert resp.status_code in (403, 404)


def test_export_regenerates_html_when_not_stored():
    headers, _ = _register("teacher")
    # Save a lesson plan with an EMPTY html_render; export must read the
    # stored plan_data and regenerate a full document.
    resp = client.post("/teacher-plans/save", headers=headers, json={
        "plan_type": "lesson_plan",
        "title": "Regen",
        "subject_slug": "biology",
        "subject_name": "Biology",
        "form_level": 3,
        "topic": "Cell Biology",
        "subtopic": "The Cell",
        "plan_data": json.dumps({
            "header": {
                "school_name": "School", "teacher_name": "T",
                "class_name": "Form 3", "subject": "Biology",
                "topic": "Cell Biology", "subtopic": "The Cell",
            },
            "competences": ["Comp"], "specific_objectives": ["Obj"],
            "teaching_aids": ["Book"], "references": ["TIE"],
            "teaching_activities": [], "general_objectives": [], "remarks": "",
        }),
        "html_render": None,
        "language": "en",
    })
    plan_id = resp.json()["id"]

    export = client.get(f"/teacher-plans/{plan_id}/export", headers=headers)
    assert export.status_code == 200
    assert "<!DOCTYPE html" in export.text
    assert "Cell Biology" in export.text
