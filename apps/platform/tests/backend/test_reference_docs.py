"""Tests for the reference library (mapper, service, and API).

The autouse ``_test_db`` fixture (tests/conftest.py) swaps ``get_db()`` onto an
isolated temp SQLite database, so ``reference_docs`` starts empty and counts
below are asserted absolutely. No ``init_db()`` call is made here because it
routes through ``get_engine()`` which is not swapped by the fixture.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.config.database import get_db
from backend.main import app
from backend.models.reference_doc import ReferenceDoc
from backend.services.reference_library_service import (
    get_reference_doc,
    list_reference_docs,
    map_form_level,
    map_subject_slug,
    parse_metadata,
    serialize_doc,
)

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


# ---------- Mapper (pure functions) ----------

def test_map_subject_slug_en_and_sw():
    assert map_subject_slug(None, "LESSON PLAN FOR MATHEMATICS FORM SIX") == "mathematics"
    assert map_subject_slug(None, "MPANGOKAZI WA HISABATI DARASA LA TANO") == "mathematics"
    assert map_subject_slug(None, "LESSON PLAN FOR BOOK-KEEPING FORM TWO") == "bookkeeping"
    assert map_subject_slug(None, "SCHEME OF WORK FOR ACCOUNTANCY FORM FIVE") == "bookkeeping"
    assert map_subject_slug(None, "LESSON PLAN FOR CIVICS AND MORAL EDUCATION") == "history_civics"
    assert map_subject_slug(None, "SCHEME FOR URABIA NA MAADILI") == "history_civics"
    assert map_subject_slug(None, "LESSON PLAN FOR ADVANCED MATHEMATICS") == "additional_mathematics"
    assert map_subject_slug(None, "SCHEME OF WORK FOR COMMERCE FORM ONE") == "business_studies"
    assert map_subject_slug(None, "LESSON PLAN FOR AGRICULTURE") == "agriculture"


def test_map_subject_slug_unmappable():
    assert map_subject_slug(None, "LESSON PLAN FOR ECONOMICS FORM FIVE") is None
    assert map_subject_slug(None, "SCHEME FOR MUSIC") is None


def test_map_form_level():
    assert map_form_level("Form 2", "") == 2
    assert map_form_level("Standard 6", "") == 6
    assert map_form_level("", "KIDATO CHA TANO") == 5
    assert map_form_level("", "MPANGO KAZI WA SAYANSI DARASA LA NNE") == 4
    assert map_form_level("", "SCHEME OF WORK - STD 7") == 7
    assert map_form_level("unrelated", "no form mentioned") is None


def test_parse_metadata():
    slug, form, name = parse_metadata("LESSON PLAN FOR GEOGRAPHY FORM THREE", "Form 3")
    assert slug == "geography"
    assert form == 3
    assert name is not None and name.lower()


# ---------- Service (browse/search/get against the isolated DB) ----------

def test_service_browse_by_type():
    db = next(get_db())
    try:
        _seed_doc(db, doc_type="lesson_plan", source_id="10", title="A MATH LESSON", slug="mathematics", form=1)
        _seed_doc(db, doc_type="scheme_of_work", source_id="11", title="A HISTORY SCHEME", slug="history", form=2)
        lessons = list_reference_docs(db, doc_type="lesson_plan")
        assert len(lessons) == 1
        assert lessons[0].doc_type == "lesson_plan"
        schemes = list_reference_docs(db, doc_type="scheme_of_work")
        assert len(schemes) == 1
    finally:
        db.close()


def test_service_search_filters():
    db = next(get_db())
    try:
        _seed_doc(db, source_id="20", title="LESSON PLAN FOR MATHEMATICS FORM TWO", slug="mathematics", form=2)
        _seed_doc(db, source_id="21", title="LESSON PLAN FOR KISWAHILI FORM TWO", slug="kiswahili", form=2)
        _seed_doc(db, source_id="22", title="LESSON PLAN FOR ENGLISH FORM FOUR", slug="english", form=4)
        found = list_reference_docs(db, subject_slug="kiswahili")
        assert len(found) == 1 and found[0].source_id == "21"
        found = list_reference_docs(db, form_level=2)
        assert len(found) == 2
        found = list_reference_docs(db, query="kiswahili")
        assert len(found) == 1
    finally:
        db.close()


def test_service_get_by_source_and_serialize():
    db = next(get_db())
    try:
        _seed_doc(db, source_id="30", title="A REFERENCE DOC")
        saved = get_reference_doc(db, next(g for g in list_reference_docs(db)).id)
        assert saved is not None
        payload = serialize_doc(saved)
        assert payload["doc_type"] == "lesson_plan"
        assert payload["title"] == "A REFERENCE DOC"
        assert payload["content"] == {"plan_details": []}
    finally:
        db.close()


# ---------- API ----------

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
