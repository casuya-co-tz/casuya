import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user

client = TestClient(app)


def _headers():
    email = f"apitest-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", "API Tester", "admin")
    return {"Authorization": f"Bearer {result['access_token']}"}


def test_subjects_crud():
    resp = client.get("/subjects/", headers=_headers())
    assert resp.status_code == 200
    resp = client.post("/subjects/", json={"name": "Physics", "slug": "physics"}, headers=_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Physics"


def test_topics_crud():
    subjects = client.get("/subjects/", headers=_headers()).json()
    if subjects:
        resp = client.post("/topics/", json={
            "subject_id": subjects[0]["id"],
            "title": "Mechanics",
            "form_level": "II",
        }, headers=_headers())
        assert resp.status_code == 200


def test_users_me():
    resp = client.get("/users/me", headers=_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data


def test_students_list():
    resp = client.get("/students/", headers=_headers())
    assert resp.status_code == 200


def test_teachers_list():
    resp = client.get("/teachers/", headers=_headers())
    assert resp.status_code == 200


def test_notifications():
    resp = client.get("/notifications/", headers=_headers())
    assert resp.status_code == 200


def test_search():
    resp = client.get("/search/?q=test", headers=_headers())
    assert resp.status_code == 200


def test_analytics_overview():
    resp = client.get("/analytics/overview", headers=_headers())
    assert resp.status_code == 200
