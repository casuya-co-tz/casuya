import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from backend.services.ai_bridge.tests import TEST_TYPES

client = TestClient(app)


def _headers():
    email = f"ait-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", "AI Test Tester", "admin")
    return {"Authorization": f"Bearer {result['access_token']}"}


def _payload(**overrides):
    payload = {
        "test_type": "topical",
        "topic": "Acids, Bases and Salts",
        "subtopic": "",
        "count": 5,
        "subject_slug": "chemistry",
        "form_level": 4,
    }
    payload.update(overrides)
    return payload


def test_generate_tests_rejects_unknown_test_type():
    resp = client.post("/ai/tests/generate", json=_payload(test_type="bonus"), headers=_headers())
    assert resp.status_code == 422
    assert "test_type" in resp.json()["detail"]
    for t in TEST_TYPES:
        assert t in resp.json()["detail"]


def test_generate_tests_rejects_unknown_subject():
    resp = client.post("/ai/tests/generate", json=_payload(subject_slug="history"), headers=_headers())
    assert resp.status_code == 422
    assert "subject_slug" in resp.json()["detail"]


def test_generate_tests_rejects_form_out_of_range():
    resp = client.post("/ai/tests/generate", json=_payload(form_level=9), headers=_headers())
    assert resp.status_code == 422
    assert "form_level" in resp.json()["detail"]


def test_generate_tests_rejects_missing_topic_and_subtopic():
    resp = client.post("/ai/tests/generate", json=_payload(topic="", subtopic=""), headers=_headers())
    assert resp.status_code == 422
    assert "topic" in resp.json()["detail"]


def test_generate_tests_accepts_topics_subtopics_lists():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(
            topic="",
            subtopic="",
            topics=["Acids, Bases and Salts", "Salts and Solutions"],
            subtopics=["Preparation of Salts", "Uses of Salts"],
        ),
        headers=_headers(),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "questions" in data
    assert data["count"] == len(data["questions"])
    assert data["topics"] == ["Acids, Bases and Salts", "Salts and Solutions"]
    assert data["subtopics"] == ["Preparation of Salts", "Uses of Salts"]


def test_generate_tests_rejects_too_many_topics():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(topics=[f"Topic {i}" for i in range(40)]),
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "30" in resp.json()["detail"]


def test_generate_tests_rejects_overlong_topic_title():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(topics=["x" * 200]),
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "120" in resp.json()["detail"]


def test_generate_tests_rejects_too_many_subtopics():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(subtopics=[f"Subtopic {i}" for i in range(40)]),
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "30" in resp.json()["detail"]


def test_generate_tests_rejects_count_out_of_range():
    resp = client.post("/ai/tests/generate", json=_payload(count=0), headers=_headers())
    assert resp.status_code == 422
    assert "count" in resp.json()["detail"]
    resp = client.post("/ai/tests/generate", json=_payload(count=25), headers=_headers())
    assert resp.status_code == 422


def test_generate_tests_returns_questions_for_valid_request():
    resp = client.post("/ai/tests/generate", json=_payload(), headers=_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert data["count"] == len(data["questions"])
    assert data["testType"] == "topical"
    assert data["testTypeLabel"] == "Topical Test"
    assert data["subject"] == "Chemistry"


def test_generate_tests_accepts_all_test_types():
    for test_type in TEST_TYPES:
        resp = client.post("/ai/tests/generate", json=_payload(test_type=test_type), headers=_headers())
        assert resp.status_code == 200, f"{test_type} failed: {resp.text}"
        assert "questions" in resp.json()