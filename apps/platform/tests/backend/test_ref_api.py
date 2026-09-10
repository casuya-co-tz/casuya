"""Tests for the reference library API endpoints."""

import json

from fastapi.testclient import TestClient

from backend.config.database import get_db
from backend.main import app
from backend.models.reference_doc import ReferenceDoc

client = TestClient(app)


def _seed_doc(db, doc_type="lesson_plan", source_id="1", title="LESSON PLAN FOR MATHEMATICS FORM TWO 2026",
              standard="Form 2", content=None, slug="mathematics", form=2):
    doc = ReferenceDoc(
        doc_type=doc_type,
        source_id=source_id,
        source_url=f"https://api.example/reference/{doc_type}/{source_id}",
        title=title,
        subject_name="Mathematics",
        subject_slug=slug,
        form_level=form,
        standard=standard,
        content=json.dumps(content or {"plan_details": []}, ensure_ascii=False),
    )
    db.add(doc)
    db.commit()
    return doc


def test_api_stats_and_browse():
    db = next(get_db())
    try:
        _seed_doc(db, doc_type="lesson_plan", source_id="40", title="L1")
        _seed_doc(db, doc_type="scheme_of_work", source_id="41", title="S1")
    finally:
        db.close()
    stats = client.get("/reference-docs/stats").json()
    assert stats["lesson_plans"] == 1
    assert stats["schemes_of_work"] == 1
    assert stats["total"] == 2
    body = client.get("/reference-docs", params={"doc_type": "lesson_plan"}).json()
    assert body["total"] == 1
    assert body["items"][0]["doc_type"] == "lesson_plan"


def test_api_search_and_get_by_id():
    db = next(get_db())
    sid = None
    try:
        doc = _seed_doc(db, source_id="50", title="LESSON PLAN FOR CHEMISTRY FORM ONE", slug="chemistry", form=1)
        sid = doc.id
    finally:
        db.close()
    found = client.get("/reference-docs", params={"query": "chemistry"}).json()
    assert found["total"] == 1
    got = client.get(f"/reference-docs/{sid}").json()
    assert got["subject_slug"] == "chemistry"
    assert got["form_level"] == 1


def test_api_get_by_id_404_and_invalid_type():
    assert client.get("/reference-docs/00000000-0000-0000-0000-000000000000").status_code == 404
    assert client.get("/reference-docs", params={"doc_type": "bogus"}).status_code == 422


def test_api_pagination():
    db = next(get_db())
    try:
        for i in range(5):
            _seed_doc(db, source_id=str(100 + i), title=f"LESSON {i}", slug="mathematics", form=1)
    finally:
        db.close()
    page = client.get("/reference-docs", params={"limit": 2, "offset": 0}).json()
    assert page["total"] == 5
    assert len(page["items"]) == 2
    assert page["offset"] == 0
    page2 = client.get("/reference-docs", params={"limit": 2, "offset": 4}).json()
    assert len(page2["items"]) == 1
