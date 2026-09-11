import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from backend.services.ai_bridge.prompts import check_subject_relevance

client = TestClient(app)


def _headers():
    email = f"aiq-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", "AI Q Tester", "admin")
    return {"Authorization": f"Bearer {result['access_token']}"}


def test_generate_questions_rejects_unknown_subject():
    resp = client.post(
        "/ai/questions/generate",
        json={
            "lesson_html": "<p>Algebra equations</p>",
            "count": 3,
            "subject_slug": "history",
            "form_level": 1,
        },
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "subject_slug" in resp.json()["detail"]


def test_generate_questions_rejects_form_out_of_range():
    resp = client.post(
        "/ai/questions/generate",
        json={
            "lesson_html": "<p>Algebra equations</p>",
            "count": 3,
            "subject_slug": "mathematics",
            "form_level": 9,
        },
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "form_level" in resp.json()["detail"]


def test_generate_questions_rejects_irrelevant_content():
    resp = client.post(
        "/ai/questions/generate",
        json={
            "lesson_html": "<p>The history of the Roman Empire spans several centuries and shaped modern governance.</p>",
            "count": 3,
            "subject_slug": "mathematics",
            "form_level": 2,
        },
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "does not appear to be about Mathematics" in resp.json()["detail"]


def test_check_subject_relevance_permits_matching_content():
    assert check_subject_relevance("Solve quadratic equations using the formula.", "mathematics") is None
    assert check_subject_relevance("Bonds between atoms form molecules.", "chemistry") is None
    assert check_subject_relevance("Force equals mass times acceleration.", "physics") is None


def test_check_subject_relevance_ignores_short_text():
    assert check_subject_relevance("hello", "mathematics") is None