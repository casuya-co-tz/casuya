"""Tests for platform settings: module visibility and the new teacher modules."""

import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user

client = TestClient(app)


def _register(role: str):
    email = f"settings-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", "Settings Tester", role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


def test_admin_sees_new_teacher_modules():
    admin_headers, _ = _register("admin")
    resp = client.get("/settings/modules", headers=admin_headers)
    assert resp.status_code == 200
    teacher = resp.json().get("teacher", {})
    assert teacher.get("class") is True
    assert teacher.get("teaching-docs") is True


def test_new_teacher_modules_default_enabled_for_teacher():
    teacher_headers, _ = _register("teacher")
    resp = client.get("/settings/modules/my", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json().get("teaching-docs") is True
    assert resp.json().get("class") is True


def test_admin_can_toggle_teaching_docs_off():
    admin_headers, _ = _register("admin")
    teacher_headers, _ = _register("teacher")

    current = client.get("/settings/modules", headers=admin_headers).json()

    # Use whatever subset the backend exposes to ensure the toggle persists.
    updated = client.put("/settings/modules", headers=admin_headers, json={
        "teacher": {"teaching-docs": False, "class": False},
    }).json()
    assert updated["teacher"]["teaching-docs"] is False
    assert updated["teacher"]["class"] is False

    # Teacher sees the disabled state.
    my = client.get("/settings/modules/my", headers=teacher_headers).json()
    assert my["teaching-docs"] is False
    assert my["class"] is False


def test_student_role_not_affected_by_teacher_toggle():
    admin_headers, _ = _register("admin")
    student_headers, _ = _register("student")

    client.put("/settings/modules", headers=admin_headers, json={
        "teacher": {"teaching-docs": False},
    })
    resp = client.get("/settings/modules/my", headers=student_headers)
    assert resp.status_code == 200
    assert "teaching-docs" not in resp.json()
