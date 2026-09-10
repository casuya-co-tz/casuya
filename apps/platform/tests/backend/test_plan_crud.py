"""Tests for plan CRUD API endpoints (save / list / get / delete / export).

Covers teacher role requirements and HTML regeneration on export when the
stored render is empty.
"""

import json
import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user

client = TestClient(app)


def _register(role: str):
    email = f"plan-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", role.title(), role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


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
    assert "Biology" in export.text
