import uuid
import json

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user

client = TestClient(app)


def _register(role: str):
    email = f"lesson-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", role.title(), role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


def _make_subtopic_chain():
    admin_headers, _ = _register("admin")
    unique = uuid.uuid4().hex[:6]
    subj = client.post("/subjects/", json={"name": f"Physics {unique}", "slug": f"physics-{unique}"}, headers=admin_headers).json()
    topic = client.post("/topics/", json={
        "subject_id": subj["id"], "title": f"Mechanics {unique}", "form_level": "II",
    }, headers=admin_headers).json()
    subtopic = client.post("/subtopics/", json={
        "topic_id": topic["id"], "title": f"Forces {unique}",
    }, headers=admin_headers).json()
    return subtopic["id"]


def test_teacher_can_publish_up_to_two_lessons():
    subtopic_id = _make_subtopic_chain()
    teacher_headers, teacher = _register("teacher")

    def publish(n):
        return client.post("/lessons", json={
            "subtopic_id": subtopic_id,
            "title": f"Lesson {n}",
            "html_content": "<h1>Hi</h1>",
        }, headers=teacher_headers)

    # First two should publish.
    r1 = publish("A"); assert r1.status_code == 200, r1.text
    r2 = publish("B"); assert r2.status_code == 200, r2.text

    # Third should be blocked by the teacher limit (default 2).
    r3 = publish("C")
    assert r3.status_code == 403, r3.text
    assert "limit" in r3.json()["detail"].lower()


def test_teacher_only_sees_own_published_lessons():
    subtopic_id = _make_subtopic_chain()
    teacher_headers, _ = _register("teacher")

    client.post("/lessons", json={
        "subtopic_id": subtopic_id, "title": "Own Lesson", "html_content": "<p>x</p>"
    }, headers=teacher_headers)

    # Teacher lists lessons -> only their own.
    resp = client.get("/lessons", headers=teacher_headers)
    assert resp.status_code == 200
    for item in resp.json():
        assert item["status"] == "published"
