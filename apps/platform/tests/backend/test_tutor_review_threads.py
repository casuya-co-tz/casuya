"""Tests for tutor review queue and server-side conversation threads."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

import backend.config.database as db_module
from backend.main import app
from backend.services.ai_bridge.tutor_review_service import enqueue_review, list_reviews, resolve_review
from backend.services.ai_bridge.tutor_thread_service import get_thread, save_thread
from tests.backend.conftest import create_admin_user

client = TestClient(app)


def _student_headers():
    email = f"student-{uuid.uuid4().hex[:8]}@test.com"
    resp = client.post(
        "/auth/register",
        json={"email": email, "password": "student123", "full_name": "Test Student", "role": "student"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_review_service_enqueue_list_resolve():
    with db_module.SessionLocal() as db:
        item = enqueue_review(
            db,
            question="What is oxidation?",
            response="Oxidation is loss of electrons.",
            user_id="user-1",
            lesson_id="lesson-1",
            subject_slug="chemistry",
            format_level="partial",
            flagged_terms=["oxidation"],
        )
        assert item is not None
        pending = list_reviews(db, status="pending", limit=10)
        assert any(r.id == item.id for r in pending)

        resolved = resolve_review(db, item.id, status="approved", reviewer_id="admin-1")
        assert resolved is not None
        assert resolved.status == "approved"
        assert resolved.reviewer_id == "admin-1"


def test_thread_service_save_and_get():
    with db_module.SessionLocal() as db:
        messages = [
            {"role": "user", "text": "Hello"},
            {"role": "tutor", "text": "Hi there"},
        ]
        saved = save_thread(db, "user-abc", "lesson-xyz", messages)
        assert len(saved) == 2
        loaded = get_thread(db, "user-abc", "lesson-xyz")
        assert loaded[0]["text"] == "Hello"
        assert loaded[1]["text"] == "Hi there"


def test_tutor_thread_api_roundtrip():
    headers = _student_headers()
    lesson_id = "intro-linear-equations"

    put = client.put(
        f"/ai/tutor/thread/{lesson_id}",
        headers=headers,
        json={"messages": [{"role": "user", "text": "What is x?"}]},
    )
    assert put.status_code == 200, put.text
    assert put.json()["messages"][0]["text"] == "What is x?"

    got = client.get(f"/ai/tutor/thread/{lesson_id}", headers=headers)
    assert got.status_code == 200, got.text
    assert got.json()["messages"][0]["text"] == "What is x?"


def test_ai_quality_includes_review_queue():
    with db_module.SessionLocal() as db:
        enqueue_review(
            db,
            question="Flagged question?",
            response="Uncertain answer.",
            flagged_terms=["term-a"],
            format_level="partial",
        )

    _, token = create_admin_user(f"admin-{uuid.uuid4().hex[:8]}@test.com")
    resp = client.get("/ai/quality", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "review_queue" in data
    assert any("Flagged question?" in (item.get("question") or "") for item in data["review_queue"])


def test_resolve_review_api():
    with db_module.SessionLocal() as db:
        item = enqueue_review(
            db,
            question="Needs review",
            response="Maybe wrong.",
            flagged_terms=["maybe"],
        )

    _, token = create_admin_user(f"admin-{uuid.uuid4().hex[:8]}@test.com")
    resp = client.patch(
        f"/ai/review/{item.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "dismissed"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "dismissed"
