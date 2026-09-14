"""Tests for platform settings: module visibility and the new teacher modules."""

import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from tests.backend.conftest import create_admin_user

client = TestClient(app)


def _register(role: str):
    email = f"settings-{role}-{uuid.uuid4().hex[:8]}@test.com"
    if role == "admin":
        user_id, token = create_admin_user(email)
        return {"Authorization": f"Bearer {token}"}, {"user_id": user_id, "access_token": token, "role": "admin"}
    result = register_user(email, "test123", "Settings Tester", role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


def test_admin_sees_new_teacher_modules():
    admin_headers, _ = _register("admin")
    resp = client.get("/settings/modules", headers=admin_headers)
    assert resp.status_code == 200
    teacher = resp.json().get("teacher", {})
    assert teacher.get("class") is True
    assert teacher.get("teaching-docs") is True


def test_admin_sees_test_generator_and_library_modules():
    admin_headers, _ = _register("admin")
    resp = client.get("/settings/modules", headers=admin_headers)
    assert resp.status_code == 200
    for role in ("student", "teacher"):
        mods = resp.json().get(role, {})
        assert mods.get("test-generator") is True
        assert mods.get("library") is True


def test_new_teacher_modules_default_enabled_for_teacher():
    teacher_headers, _ = _register("teacher")
    resp = client.get("/settings/modules/my", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json().get("teaching-docs") is True
    assert resp.json().get("class") is True


def test_new_student_modules_default_enabled_for_student():
    student_headers, _ = _register("student")
    resp = client.get("/settings/modules/my", headers=student_headers)
    assert resp.status_code == 200
    assert resp.json().get("test-generator") is True
    assert resp.json().get("library") is True


def test_admin_can_toggle_test_generator_and_library_off():
    admin_headers, _ = _register("admin")
    student_headers, _ = _register("student")
    teacher_headers, _ = _register("teacher")

    updated = client.put("/settings/modules", headers=admin_headers, json={
        "student": {"test-generator": False, "library": False},
        "teacher": {"test-generator": False, "library": False},
    }).json()
    assert updated["student"]["test-generator"] is False
    assert updated["student"]["library"] is False
    assert updated["teacher"]["test-generator"] is False
    assert updated["teacher"]["library"] is False

    student_my = client.get("/settings/modules/my", headers=student_headers).json()
    assert student_my["test-generator"] is False
    assert student_my["library"] is False

    teacher_my = client.get("/settings/modules/my", headers=teacher_headers).json()
    assert teacher_my["test-generator"] is False
    assert teacher_my["library"] is False


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
