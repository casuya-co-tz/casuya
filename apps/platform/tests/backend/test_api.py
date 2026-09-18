import uuid

from fastapi.testclient import TestClient

from backend.main import app
from tests.backend.conftest import create_admin_user

client = TestClient(app)


def _headers():
    email = f"apitest-{uuid.uuid4().hex[:8]}@test.com"
    _, token = create_admin_user(email)
    return {"Authorization": f"Bearer {token}"}


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


def test_student_dashboard_aggregate():
    from backend.services.auth_service import register_user

    result = register_user(
        f"dash-{uuid.uuid4().hex[:8]}@test.com", "test123", "Dash Student", "student"
    )
    headers = {"Authorization": f"Bearer {result['access_token']}"}
    resp = client.get("/students/me/dashboard", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "profile" in data
    assert "classroom" in data
    assert "subjects" in data
    assert "progress_by_subject" in data
    assert "stats" in data
    assert "streak" in data["stats"]
    assert data["profile"]["user_id"] == result["user_id"]


def test_teacher_dashboard_aggregate():
    from backend.services.auth_service import register_user

    result = register_user(
        f"tdash-{uuid.uuid4().hex[:8]}@test.com", "test123", "Dash Teacher", "teacher"
    )
    headers = {"Authorization": f"Bearer {result['access_token']}"}
    resp = client.get("/teachers/me/dashboard", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "overview" in data
    assert "lesson_count" in data
    assert "classroom" in data
    assert "bookmark_count" in data
    assert "avg_completion_rate" in data["overview"]
    assert data["classroom"]["classroom"]["code"]



def test_analytics_overview():
    resp = client.get("/analytics/overview", headers=_headers())
    assert resp.status_code == 200
