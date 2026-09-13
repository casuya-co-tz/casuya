from fastapi.testclient import TestClient

import backend.config.database as db_module
from backend.config.security import hash_password
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


def _create_admin(email: str) -> dict:
    """Create an admin directly in the DB, mirroring database/seeds/create_admin.py.

    Admins must never be obtainable through the public register endpoint.
    """
    with db_module.SessionLocal() as s:
        user = User(
            email=email,
            hashed_password=hash_password("test123"),
            full_name=f"Admin {email}",
            role="admin",
            is_active=True,
        )
        s.add(user)
        s.commit()
        user_id = user.id
    resp = client.post(
        "/auth/login", json={"email": email, "password": "test123"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    data["user_id"] = user_id
    return data


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_list_all_users_with_details():
    admin = _create_admin("admin-list@test.com")
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
    admin = _create_admin("admin-profilename@test.com")
    student = _register("student-profilename@test.com", role="student")
    with db_module.SessionLocal() as s:
        user = s.query(User).filter(User.id == student["user_id"]).first()
        user.full_name = None
        s.commit()
    resp = client.get("/users", headers=_auth_headers(admin["access_token"]))
    items = {item["email"]: item for item in resp.json()["items"]}
    assert items["student-profilename@test.com"]["full_name"] == "User student-profilename@test.com"


def test_admin_can_deactivate_and_reactivate_user():
    admin = _create_admin("admin-toggle@test.com")
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
    admin = _create_admin("admin-self@test.com")
    resp = client.patch(
        f"/users/{admin['user_id']}",
        json={"is_active": False},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 400
    assert "own account" in resp.json()["detail"]


def test_update_status_unknown_user_404():
    admin = _create_admin("admin-404@test.com")
    resp = client.patch(
        "/users/does-not-exist",
        json={"is_active": False},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resp.status_code == 404


def test_export_users_xlsx():
    admin = _create_admin("admin-export@test.com")
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


def test_public_registration_cannot_claim_admin_role():
    """Anyone can open the register endpoint, but it must never mint admin tokens."""
    resp = client.post(
        "/auth/register",
        json={
            "email": "evil-admin@test.com",
            "password": "test123",
            "full_name": "Evil",
            "role": "admin",
        },
    )
    assert resp.status_code == 409
    # The attacker must not receive any token.
    assert "access_token" not in resp.json().get("details", resp.json())

    # Legitimate roles still work and get a student/teacher token.
    student = _register("legit-student@test.com", role="student")
    assert student["role"] == "student"

    resp = client.get("/users", headers=_auth_headers(student["access_token"]))
    assert resp.status_code == 403
