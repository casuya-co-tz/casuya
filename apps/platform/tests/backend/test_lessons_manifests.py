import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from backend.services.lesson.essential import strip_essential_html
from tests.backend.conftest import create_admin_user

client = TestClient(app)


def _admin():
    email = f"manifest-admin-{uuid.uuid4().hex[:8]}@test.com"
    _, token = create_admin_user(email)
    return {"Authorization": f"Bearer {token}"}


def _student():
    email = f"manifest-student-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", "Student", "student")
    return {"Authorization": f"Bearer {result['access_token']}"}


def _make_published_lesson(html="<h1>Hi</h1><video src='/x.mp4'></video>"):
    admin = _admin()
    unique = uuid.uuid4().hex[:6]
    subj = client.post(
        "/subjects/", json={"name": f"Math {unique}", "slug": f"math-{unique}"}, headers=admin
    ).json()
    topic = client.post(
        "/topics/",
        json={"subject_id": subj["id"], "title": f"Alg {unique}", "form_level": "II"},
        headers=admin,
    ).json()
    subtopic = client.post(
        "/subtopics/", json={"topic_id": topic["id"], "title": f"Eq {unique}"}, headers=admin
    ).json()
    created = client.post(
        "/lessons",
        json={"subtopic_id": subtopic["id"], "title": f"Lesson {unique}", "html_content": html},
        headers=admin,
    )
    assert created.status_code == 200, created.text
    lesson = created.json()
    published = client.post(f"/lessons/{lesson['id']}/publish", headers=admin)
    assert published.status_code == 200, published.text
    return lesson, admin


def test_strip_essential_html_removes_video():
    html = '<p>Intro</p><video src="/clip.mp4"></video><p>End</p>'
    out = strip_essential_html(html)
    assert "<video" not in out.lower()
    assert "casuya-essential-media" in out
    assert "Intro" in out
    assert "End" in out


def test_lessons_manifests_lists_published_slug():
    lesson, headers = _make_published_lesson()
    resp = client.get("/lessons/manifests", headers=headers)
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert isinstance(rows, list)
    match = next((r for r in rows if r["slug"] == lesson["slug"]), None)
    assert match is not None
    assert match["content_hash"]
    assert match["title"]


def test_slug_package_returns_body_html():
    lesson, headers = _make_published_lesson("<p>body-here</p>")
    resp = client.get(f"/lessons/{lesson['slug']}/package", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "body_html" in data
    assert "body-here" in data["body_html"]
    assert data["slug"] == lesson["slug"]


def test_slug_package_essential_strips_video():
    lesson, headers = _make_published_lesson("<p>Keep</p><video src='/a.mp4'></video>")
    resp = client.get(f"/lessons/{lesson['slug']}/package?essential=1", headers=headers)
    assert resp.status_code == 200, resp.text
    html = resp.json()["body_html"]
    assert "<video" not in html.lower()
    assert "Keep" in html
    assert resp.json()["essential"] is True


def test_uuid_package_still_returns_metadata():
    lesson, headers = _make_published_lesson("<p>meta</p>")
    student = _student()
    resp = client.get(f"/lessons/{lesson['id']}/package", headers=student)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "lesson" in data
    assert data["lesson"]["id"] == lesson["id"]
    assert "body_html" not in data
