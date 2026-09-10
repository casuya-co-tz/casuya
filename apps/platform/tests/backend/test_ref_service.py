"""Tests for the reference library service layer (browse, search, get, serialize)."""

import json

from backend.config.database import get_db
from backend.models.reference_doc import ReferenceDoc
from backend.services.reference_library_service import (
    get_reference_doc,
    list_reference_docs,
    serialize_doc,
)


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
