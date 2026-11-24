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
    # The Teaching Docs view was removed — it must no longer be a module.
    assert "teaching-docs" not in teacher


def test_admin_sees_files_and_library_modules():
    admin_headers, _ = _register("admin")
    resp = client.get("/settings/modules", headers=admin_headers)
    assert resp.status_code == 200
    for role in ("student", "teacher"):
        mods = resp.json().get(role, {})
        assert mods.get("files") is True
        assert mods.get("library") is True


def test_new_teacher_modules_default_enabled_for_teacher():
    teacher_headers, _ = _register("teacher")
    resp = client.get("/settings/modules/my", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json().get("class") is True


def test_new_student_modules_default_enabled_for_student():
    student_headers, _ = _register("student")
    resp = client.get("/settings/modules/my", headers=student_headers)
    assert resp.status_code == 200
    assert resp.json().get("files") is True
    assert resp.json().get("library") is True


def test_admin_can_toggle_files_and_library_off():
    admin_headers, _ = _register("admin")
    student_headers, _ = _register("student")
    teacher_headers, _ = _register("teacher")

    updated = client.put("/settings/modules", headers=admin_headers, json={
        "student": {"files": False, "library": False},
        "teacher": {"files": False, "library": False},
    }).json()
    assert updated["student"]["files"] is False
    assert updated["student"]["library"] is False
    assert updated["teacher"]["files"] is False
    assert updated["teacher"]["library"] is False

    student_my = client.get("/settings/modules/my", headers=student_headers).json()
    assert student_my["files"] is False
    assert student_my["library"] is False

    teacher_my = client.get("/settings/modules/my", headers=teacher_headers).json()
    assert teacher_my["files"] is False
    assert teacher_my["library"] is False


def test_removed_teaching_docs_module_is_stripped():
    """A stale stored entry for a removed module must not resurface."""
    import json

    admin_headers, _ = _register("admin")

    # Simulate a settings row written before the Teaching Docs view was removed.
    stale = client.get("/settings/modules", headers=admin_headers).json()
    stale.setdefault("teacher", {})["teaching-docs"] = False

    import backend.config.database as db_module
    from backend.api.settings.modules import MODULE_VISIBILITY_KEY
    from backend.models.setting import Setting

    with db_module.SessionLocal() as s:
        row = s.query(Setting).filter(Setting.key == MODULE_VISIBILITY_KEY).first()
        if row:
            row.value = json.dumps(stale)
        else:
            s.add(Setting(key=MODULE_VISIBILITY_KEY, value=json.dumps(stale)))
        s.commit()

    teacher = client.get("/settings/modules", headers=admin_headers).json().get("teacher", {})
    assert "teaching-docs" not in teacher


def test_student_role_not_affected_by_teacher_toggle():
    student_headers, _ = _register("student")

    resp = client.get("/settings/modules/my", headers=student_headers)
    assert resp.status_code == 200
    # Teacher-only modules never appear in the student payload.
    assert "class" not in resp.json()
