import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user

client = TestClient(app)


def _register(role: str):
    email = f"classroom-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", role.title(), role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


def test_teacher_gets_class_code_and_student_joins():
    teacher_headers, _ = _register("teacher")
    student_headers, _ = _register("student")

    # Teacher's classroom is created with a code on first access.
    resp = client.get("/classrooms/me", headers=teacher_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"]
    code = data["code"]
    assert len(code) >= 6

    # Teacher sees no connected students yet.
    resp = client.get("/classrooms/me/students", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # Student joins with the code.
    resp = client.post("/classrooms/join", json={"code": code.lower()}, headers=student_headers)
    assert resp.status_code == 200
    join_data = resp.json()
    assert join_data["status"] == "joined"
    assert join_data["classroom"]["code"] == code

    # Teacher now sees the connected student.
    resp = client.get("/classrooms/me/students", headers=teacher_headers)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total"] == 1
    assert payload["students"][0]["email"].startswith("classroom-student-")

    # Student sees their teacher connection.
    resp = client.get("/classrooms/me", headers=student_headers)
    assert resp.status_code == 200
    assert resp.json()["classroom"]["code"] == code


def test_student_cannot_join_with_wrong_code():
    student_headers, _ = _register("student")
    resp = client.post("/classrooms/join", json={"code": "XXXXXX"}, headers=student_headers)
    assert resp.status_code == 404


def test_regenerate_code():
    teacher_headers, _ = _register("teacher")
    resp = client.get("/classrooms/me", headers=teacher_headers)
    old_code = resp.json()["code"]

    resp = client.post("/classrooms/me/code/regenerate", json={}, headers=teacher_headers)
    assert resp.status_code == 200
    new_code = resp.json()["code"]
    assert new_code != old_code
