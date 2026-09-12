from fastapi.testclient import TestClient

import backend.config.database as db_module
from backend.main import app
from backend.models.user import User

client = TestClient(app)


def _register(email: str, role: str = "student", phone: str | None = None) -> dict:
    resp = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "test123",
            "full_name": f"User {email}",
            "role": role,
            "phone": phone,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_list_all_users_with_details():
    admin = _register("admin-list@test.com", role="admin")
    _register("teacher-list@test.com", role="teacher")
    student = _register("student-list@test.com", role="student", phone="+255700000001")

    resp = client.get("/users", headers=_auth_headers(admin["access_token"]))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3

    items = {item["email"]: item for item in data["items"]}
    assert items["student-list@test.com"]["full_name"] == "User student-list@test.com"
    assert items["student-list@test.com"]["phone"] == "+255700000001"
    assert items["student-list@test.com"]["is_active"] is True
    assert items["student-list@test.com"]["profile"]["type"] == "student"
    assert items["teacher-list@test.com"]["profile"]["type"] == "teacher"
    assert "created_at" in items["admin-list@test.com"]

    assert student["user_id"] == items["student-list@test.com"]["id"]


def test_non_admin_cannot_list_users():
    student = _register("non-admin@test.com", role="student")
    resp = client.get("/users", headers=_auth_headers(student["access_token"]))
    assert resp.status_code == 403


def test_registration_stores_full_name_on_user():
    student = _register("name-on-user@test.com", role="student")
    with db_module.SessionLocal() as s:
        user = s.query(User).filter(User.id == student["user_id"]).first()
        assert user.full_name == "User name-on-user@test.com"


def test_list_falls_back_to_profile_name():
    """Legacy users whose User.full_name is empty still show the profile name."""
    admin = _register("admin-profilename@test.com", role="admin")
    student = _register("student-profilename@test.com", role="student")
    with db_module.SessionLocal() as s:
        user = s.query(User).filter(User.id == student["user_id"]).first()
        user.full_name = None
        s.commit()
    resp = client.get("/users", headers=_auth_headers(admin["access_token"]))
    items = {item["email"]: item for item in resp.json()["items"]}
    assert items["student-profilename@test.com"]["full_name"] == "User student-profilename@test.com"


def test_admin_can_deactivate_and_reactivate_user():
    admin = _register("admin-toggle@test.com", role="admin")
    student = _register("student-toggle@test.com", role="student")
    user_id = student["user_id"]

    resp = client.patch(
        f"/users/{user_id}",
        json={"is_active": False},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # The deactivated user can no longer authenticate.
    resp = client.post(
        "/auth/login", json={"email": "student-toggle@test.com", "password": "test123"}
    )
    assert resp.status_code == 401

    # Deactivated users appear in the list for a future admin lookup.
    resp = client.get("/users?limit=200", headers=_auth_headers(admin["access_token"]))
    items = {item["email"]: item for item in resp.json()["items"]}
    assert items["student-toggle@test.com"]["is_active"] is False

    resp = client.patch(
        f"/users/{user_id}",
        json={"is_active": True},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    resp = client.post(
        "/auth/login", json={"email": "student-toggle@test.com", "password": "test123"}
    )
    assert resp.status_code == 200


def test_admin_cannot_deactivate_self():
    admin = _register("admin-self@test.com", role="admin")
    resp = client.patch(
        f"/users/{admin['user_id']}",
        json={"is_active": False},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 400
    assert "own account" in resp.json()["detail"]


def test_update_status_unknown_user_404():
    admin = _register("admin-404@test.com", role="admin")
    resp = client.patch(
        "/users/does-not-exist",
        json={"is_active": False},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 404


def test_export_users_xlsx():
    admin = _register("admin-export@test.com", role="admin")
    _register("student-export@test.com", role="student", phone="+255700000002")

    resp = client.get("/users/export", headers=_auth_headers(admin["access_token"]))
    assert resp.status_code == 200
    assert (
        resp.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "casuya-users.xlsx" in resp.headers.get("content-disposition", "")
    # XLSX files are ZIP archives (PK magic bytes at the start).
    assert resp.content[:2] == b"PK"
    assert len(resp.content) > 0
