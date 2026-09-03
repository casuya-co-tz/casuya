"""Tests for teacher plan (lesson plan / scheme of work) generation and CRUD."""

import json
import uuid

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
    # weeks derived from the knowledge base subtopics (2 topics x 2 subtopics).
    assert [w["specific_competence"] for w in plan["weeks"]] == [
        "1.1 Cell Structure", "1.2 Cell Division", "2.1 DNA and RNA", "2.2 Mendelian Inheritance",
    ]
    assert plan["weeks"][0]["main_competence"] == "1.0 Cell Biology"
    assert "Describe the cell" in plan["weeks"][0]["learning_activities"]
    assert plan["weeks"][0]["periods"] == 8
    # Term I maps the first 4 weeks to January (4 weeks per month).
    assert all(w["month"] == "January" for w in plan["weeks"])

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
