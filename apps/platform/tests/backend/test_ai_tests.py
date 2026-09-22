import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.ai_bridge.tests import TEST_TYPES
from tests.backend.conftest import create_admin_user

client = TestClient(app)


def _headers():
    email = f"ait-{uuid.uuid4().hex[:8]}@test.com"
    _, token = create_admin_user(email)
    return {"Authorization": f"Bearer {token}"}


def _payload(**overrides):
    payload = {
        "test_type": "topical",
        "topic": "Acids, Bases and Salts",
        "subtopic": "",
        "subject_slug": "chemistry",
        "form_level": 4,
    }
    payload.update(overrides)
    return payload


def test_generate_tests_rejects_unknown_test_type():
    resp = client.post("/ai/tests/generate", json=_payload(test_type="bonus"), headers=_headers())
    assert resp.status_code == 422
    assert "test_type" in resp.json()["detail"]


def test_generate_tests_rejects_unknown_subject():
    resp = client.post("/ai/tests/generate", json=_payload(subject_slug="history"), headers=_headers())
    assert resp.status_code == 422
    assert "subject_slug" in resp.json()["detail"]


def test_generate_tests_rejects_form_out_of_range():
    resp = client.post("/ai/tests/generate", json=_payload(form_level=9), headers=_headers())
    assert resp.status_code == 422
    assert "form_level" in resp.json()["detail"]


def test_generate_tests_rejects_missing_topic_for_focused_types():
    resp = client.post("/ai/tests/generate", json=_payload(topic="", subtopic=""), headers=_headers())
    assert resp.status_code == 422
    assert "topic" in resp.json()["detail"]


def test_generate_tests_allows_empty_topics_for_full_form_types():
    for test_type in ("midterm", "terminal", "annual", "necta_iv"):
        resp = client.post(
            "/ai/tests/generate",
            json=_payload(test_type=test_type, topic="", subtopic=""),
            headers=_headers(),
        )
        assert resp.status_code == 200, f"{test_type} failed: {resp.text}"
        assert "paper" in resp.json()


def test_generate_tests_locks_necta_form():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(test_type="necta_iv", form_level=2),
        headers=_headers(),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["formLevel"] == 4


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
    assert "paper" in data
    assert data["paper"]["header"]["subject_code"] == "032"
    assert data["topics"] == ["Acids, Bases and Salts", "Salts and Solutions"]


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


def test_generate_tests_rejects_math_practical():
    resp = client.post(
        "/ai/tests/generate",
        json=_payload(subject_slug="mathematics", form_level=4, paper="practical"),
        headers=_headers(),
    )
    assert resp.status_code == 422
    assert "practical" in resp.json()["detail"].lower()


def test_generate_tests_returns_paper_for_valid_request():
    resp = client.post("/ai/tests/generate", json=_payload(), headers=_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "paper" in data
    assert data["paper"]["sections"]
    assert data["paper"]["header"]["total_marks"] > 0
    assert "markingScheme" in data
    assert data["testType"] == "topical"
    assert data["subject"] == "Chemistry"


def test_generate_tests_accepts_all_test_types():
    for test_type in TEST_TYPES:
        resp = client.post("/ai/tests/generate", json=_payload(test_type=test_type), headers=_headers())
        assert resp.status_code == 200, f"{test_type} failed: {resp.text}"
        assert "paper" in resp.json()


def test_test_presets_endpoint():
    resp = client.get(
        "/ai/tests/presets?subject_slug=physics&form_level=4&test_type=midterm",
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "presets" in data
    assert any(p["paper"] == "theory" for p in data["presets"])
    assert any(p["paper"] == "practical" for p in data["presets"])


def test_test_presets_lock_necta_form():
    resp = client.get(
        "/ai/tests/presets?subject_slug=physics&form_level=2&test_type=necta_iv",
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["formLevel"] == 4
    assert data["presets"], "CSEE presets must exist for Form IV"
