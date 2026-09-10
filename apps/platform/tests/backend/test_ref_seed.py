"""Tests for bundled seed/reference data integrity and grounding.

Idempotency, online-dup collapse and purge behaviour of the bundled reference
library seed. Grounding tests live in ``test_ref_seed_grounding.py``.
"""

import json

from backend.config.database import get_db
from backend.models.reference_doc import ReferenceDoc
from backend.services.reference_library_service import (
    fetch_reference_grounding,
    list_reference_docs,
)


def test_bundled_seed_is_idempotent():
    """The bundled verified reference material seeds idempotently: a re-run
    inserts and replaces nothing, and the geography library is present
    (Form 1: 18 lesson plans + 2 term schemes; Form 2: 80 lesson plans +
    2 term schemes). Physics carries verified bundles for both Form One
    (50 lesson plans + 2 term schemes) and Form Two (52 lesson plans +
    2 term schemes). Form Two also carries verified Mathematics (47 lesson
    plans + 2 term schemes), Chemistry (24 lesson plans + 2 schemes),
    Biology (24 lesson plans + 2 schemes), English (21 lesson plans + 2
    schemes), and History / Historia ya Tanzania na Maadili / Business
    Studies / Kiswahili scheme bundles. Business Studies Form One carries
    52 lesson plans + 2 term schemes, Kiswahili Form One carries 52 lesson
    plans + 2 term schemes (26 Term I, 1A-13B + 26 Term II, 14A-26B),
    Historia ya Tanzania na Maadili Form One carries 52 lesson plans +
    2 term schemes (26 Term I, 1A-13B + 26 Term II, 14A-26B), and Bible
    Knowledge Form One carries 52 lesson plans + 2 term schemes (26 Term I,
    1A-13B + 26 Term II, 14A-26B)."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        inserted, replaced, inserted_schemes, replaced_schemes, purged = seed_reference_library_local.run(db)
        assert inserted == 803
        assert replaced == 0
        assert inserted_schemes == 41
        assert replaced_schemes == 0
        assert purged == 0
        geo_lessons = list_reference_docs(db, subject_slug="geography", form_level=1, doc_type="lesson_plan")
        assert len(geo_lessons) == 18
        geo_schemes = list_reference_docs(db, subject_slug="geography", form_level=1, doc_type="scheme_of_work")
        assert len(geo_schemes) == 2
        geo_f2_lessons = list_reference_docs(db, subject_slug="geography", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(geo_f2_lessons) == 80
        geo_f2_schemes = list_reference_docs(db, subject_slug="geography", form_level=2, doc_type="scheme_of_work")
        assert len(geo_f2_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in geo_lessons + geo_schemes + geo_f2_lessons + geo_f2_schemes)
        # Form One: Chemistry (20 lessons, 2 schemes - T1 original + T2 revision/exam), Biology (30 lessons, 2 schemes), Mathematics (30 lessons, 2 schemes)
        chem_f1_lessons = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(chem_f1_lessons) == 20
        chem_f1_schemes = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="scheme_of_work")
        assert len(chem_f1_schemes) == 2

        bio_f1_lessons = list_reference_docs(db, subject_slug="biology", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(bio_f1_lessons) == 30
        bio_f1_schemes = list_reference_docs(db, subject_slug="biology", form_level=1, doc_type="scheme_of_work")
        assert len(bio_f1_schemes) == 2

        math_f1_lessons = list_reference_docs(db, subject_slug="mathematics", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(math_f1_lessons) == 30
        math_f1_schemes = list_reference_docs(db, subject_slug="mathematics", form_level=1, doc_type="scheme_of_work")
        assert len(math_f1_schemes) == 2

        for slug in ("mathematics", "chemistry", "biology"):
            f2_schemes = list_reference_docs(db, subject_slug=slug, form_level=2, doc_type="scheme_of_work")
            assert len(f2_schemes) == 2, slug
            assert all(doc.source_id.startswith("bundled:") for doc in f2_schemes)
        # History: Term I scheme only; others: 2 terms each
        hist_schemes = list_reference_docs(db, subject_slug="history", form_level=2, doc_type="scheme_of_work")
        assert len(hist_schemes) == 1
        assert all(doc.source_id.startswith("bundled:") for doc in hist_schemes)
        for slug in ("historia-ya-tanzania-na-maadili", "business_studies", "english", "kiswahili"):
            f2_schemes = list_reference_docs(db, subject_slug=slug, form_level=2, doc_type="scheme_of_work")
            assert len(f2_schemes) == 2, slug
            assert all(doc.source_id.startswith("bundled:") for doc in f2_schemes)
        # Physics: 2 term schemes
        physics_schemes = list_reference_docs(db, subject_slug="physics", form_level=2, doc_type="scheme_of_work")
        assert len(physics_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in physics_schemes)
        # Physics Form One: 50 lesson plans (26 Term I + 24 Term II) + 2 schemes
        physics_f1_lessons = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(physics_f1_lessons) == 50
        assert all(doc.source_id.startswith("bundled:") for doc in physics_f1_lessons)
        physics_f1_schemes = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="scheme_of_work")
        assert len(physics_f1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in physics_f1_schemes)
        # Business Studies Form One: 52 lesson plans (26 Term I + 26 Term II) + 2 schemes
        bsf1_lessons = list_reference_docs(db, subject_slug="business_studies", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(bsf1_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in bsf1_lessons)
        bsf1_schemes = list_reference_docs(db, subject_slug="business_studies", form_level=1, doc_type="scheme_of_work")
        assert len(bsf1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in bsf1_schemes)
        # English Form One: 63 lesson plans (39 Term I, 1A-13C + 24 Term II, 1A-8C) + 2 schemes
        eng_f1_lessons = list_reference_docs(db, subject_slug="english", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(eng_f1_lessons) == 63
        assert all(doc.source_id.startswith("bundled:") for doc in eng_f1_lessons)
        eng_f1_titles = {doc.title for doc in eng_f1_lessons}
        assert any("NO. 1A " in t and "TERM I - WEEK 1" in t for t in eng_f1_titles)
        assert any("NO. 1A " in t and "TERM II - WEEK 1" in t for t in eng_f1_titles)
        eng_f1_schemes = list_reference_docs(db, subject_slug="english", form_level=1, doc_type="scheme_of_work")
        assert len(eng_f1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in eng_f1_schemes)
        # Kiswahili Form One: 52 lesson plans (26 Term I, 1A-13B + 26 Term II, 14A-26B) + 2 schemes
        sw_f1_lessons = list_reference_docs(db, subject_slug="kiswahili", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(sw_f1_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in sw_f1_lessons)
        sw_f1_titles = {doc.title for doc in sw_f1_lessons}
        assert any("NO. 1A " in t and "TERM I - WEEK 1" in t for t in sw_f1_titles)
        assert any("NO. 14A " in t and "TERM II - WEEK 1" in t for t in sw_f1_titles)
        sw_f1_schemes = list_reference_docs(db, subject_slug="kiswahili", form_level=1, doc_type="scheme_of_work")
        assert len(sw_f1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in sw_f1_schemes)
        # Historia ya Tanzania na Maadili Form One: 52 lesson plans (26 Term I, 1A-13B + 26 Term II, 14A-26B) + 2 schemes
        htm_f1_lessons = list_reference_docs(db, subject_slug="historia-ya-tanzania-na-maadili", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(htm_f1_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in htm_f1_lessons)
        htm_f1_titles = {doc.title for doc in htm_f1_lessons}
        assert any("NO. 1A " in t and "TERM I - WEEK 1" in t for t in htm_f1_titles)
        assert any("NO. 14A " in t and "TERM II - WEEK 1" in t for t in htm_f1_titles)
        htm_f1_schemes = list_reference_docs(db, subject_slug="historia-ya-tanzania-na-maadili", form_level=1, doc_type="scheme_of_work")
        assert len(htm_f1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in htm_f1_schemes)
        # Bible Knowledge Form One: 52 lesson plans (26 Term I, 1A-13B + 26 Term II, 14A-26B) + 2 schemes
        bible_f1_lessons = list_reference_docs(db, subject_slug="bible_knowledge", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(bible_f1_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in bible_f1_lessons)
        bible_f1_titles = {doc.title for doc in bible_f1_lessons}
        assert any("NO. 1A " in t and "TERM I - WEEK 1" in t for t in bible_f1_titles)
        assert any("NO. 14A " in t and "TERM II - WEEK 1" in t for t in bible_f1_titles)
        bible_f1_schemes = list_reference_docs(db, subject_slug="bible_knowledge", form_level=1, doc_type="scheme_of_work")
        assert len(bible_f1_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in bible_f1_schemes)
        check_f2_lessons = {
            "mathematics": 47,
            "chemistry": 24,
            "biology": 24,
            "english": 21,
            "history": 13,
            "historia-ya-tanzania-na-maadili": 21,
            "business_studies": 21,
            "kiswahili": 21,
            "physics": 52,
        }
        for slug, expected in check_f2_lessons.items():
            f2_lessons = list_reference_docs(db, subject_slug=slug, form_level=2, doc_type="lesson_plan", limit=200)
            assert len(f2_lessons) == expected, slug
            assert all(doc.source_id.startswith("bundled:") for doc in f2_lessons)
        again, again_replaced, again_schemes, again_schemes_replaced, again_purged = seed_reference_library_local.run(db)
        assert again == 0
        assert again_replaced == 0
        assert again_schemes == 0
        assert again_schemes_replaced == 0
        assert again_purged == 0
    finally:
        db.close()


def test_title_level_dedup_removes_online_duplicates_without_bundled_docs():
    """Online catalog duplicates with normalised-title collisions (e.g.
    ``FORM ONE 2026`` vs ``FORM ONE-2026``) are collapsed to the latest
    record even when no bundled docs exist for that slot — catches the case
    where the bundled seed hasn't run yet."""
    from database.seeds.seed_reference_library_local import _deduplicate_online_docs

    db = next(get_db())
    try:
        from backend.models.reference_doc import ReferenceDoc

        def fake(doc_type, source_id, title, slug, form_level, standard):
            db.add(ReferenceDoc(
                doc_type=doc_type, source_id=source_id, source_url=None,
                title=title, subject_name=slug, subject_slug=slug,
                form_level=form_level, standard=standard,
                content=json.dumps({"title": title, "plan_details": [{"main_competence": "x"}]}),
            ))

        # Two near-identical titles — normalise to the same string
        fake("lesson_plan", "55", "LESSON PLAN FOR GEOGRAPHY FORM ONE 2026", "geography", 1, "Form 1")
        fake("lesson_plan", "174", "LESSON PLAN FOR GEOGRAPHY FORM ONE-2026", "geography", 1, "Form 1")
        fake("lesson_plan", "200", "LESSON PLAN FOR GEOGRAPHY FORM ONE 2026", "geography", 1, "Form 1")
        # A kiswahili pair (should stay untouched — normalised titles differ)
        fake("lesson_plan", "300", "LESSON PLAN FOR KISWAHILI FORM ONE", "kiswahili", 1, "Form 1")
        fake("lesson_plan", "301", "LESSON PLAN FOR KISWAHILI FORM ONE 2026", "kiswahili", 1, "Form 1")
        db.commit()

        purged = _deduplicate_online_docs(db)
        db.commit()

        # 3 geography duplicates (55, 174, 200) → keep 200, purge 55+174 = 2
        # kiswahili pair normalise differently ("form one" vs "form one 2026") → 0
        assert purged == 2

        geo_f1 = list_reference_docs(db, subject_slug="geography", form_level=1, doc_type="lesson_plan")
        online_f1 = [d for d in geo_f1 if not d.source_id.startswith("bundled:")]
        assert len(online_f1) == 1
        assert online_f1[0].source_id == "200"
        assert "2026" in online_f1[0].title

        sw_f1 = list_reference_docs(db, subject_slug="kiswahili", form_level=1, doc_type="lesson_plan")
        assert len(sw_f1) == 2  # not deduped — different normalised titles
    finally:
        db.close()


def test_bundled_seed_purges_conflicting_online_duplicates():
    """When the online catalog has already seeded conflicting Geography Form
    One copies (duplicate lesson plans 55/174, a noisy RALG scheme 295 and a
    mislabelled 'Afya na Mazingira' Standard 1 lesson mis-mapped to geography),
    re-running the bundled seed removes them so the library keeps ONLY the
    verified bundle for that subject/form/type. A Kiswahili Form Two scheme
    imported from the online catalog is also purged now that the bundled
    Kiswahili scheme owns that slot."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        from backend.models.reference_doc import ReferenceDoc

        def fake(doc_type, source_id, title, slug, form_level, standard):
            db.add(ReferenceDoc(
                doc_type=doc_type, source_id=source_id, source_url=None,
                title=title, subject_name=slug, subject_slug=slug,
                form_level=form_level, standard=standard,
                content=json.dumps({"title": title, "plan_details": [{"main_competence": "x"}]}),
            ))

        fake("lesson_plan", "55", "LESSON PLAN FOR GEOGRAPHY FORM ONE", "geography", 1, "Form 1")
        fake("lesson_plan", "174", "LESSON PLAN FOR GEOGRAPHY FORM ONE-2026", "geography", 1, "Form 1")
        fake("lesson_plan", "133", "MPANGO KAZI WA AFYA NA MAZINGIRA DARASA LA KWANZA", "geography", 1, "Standard 1")
        fake("lesson_plan", "557", "LESSON PLAN FOR GEOGRAPHY FORM ONE 2026", "geography", 1, "Form 1")
        fake("scheme_of_work", "295", "PMO-RALG GEOGRAPHY SCHEME OF WORK-FORM ONE", "geography", 1, "Form 1")
        fake("scheme_of_work", "555", "GEOGRAPHY SCHEME OF WORK-FORM TWO", "geography", 2, "Form 2")
        fake("lesson_plan", "556", "LESSON PLAN FOR GEOGRAPHY FORM TWO-2026", "geography", 2, "Form 2")
        fake("scheme_of_work", "999", "KISWAHILI SCHEME FORM TWO", "kiswahili", 2, "Form 2")
        db.commit()

        _, _, _, _, purged = seed_reference_library_local.run(db)
        # 4 geography F1 lesson plans (55, 174, 133, 557) + 1 F1 scheme (295)
        # + 1 F2 scheme (555) + 1 F2 lesson plan (556) + 1 Kiswahili F2 scheme
        # (999, now owned by the bundled Kiswahili scheme) = 8
        assert purged == 8

        geo_lessons = list_reference_docs(db, subject_slug="geography", form_level=1, doc_type="lesson_plan")
        assert len(geo_lessons) == 18
        assert all(doc.source_id.startswith("bundled:") for doc in geo_lessons)
        geo_schemes = list_reference_docs(db, subject_slug="geography", form_level=1, doc_type="scheme_of_work")
        assert len(geo_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in geo_schemes)
        geo_f2_schemes = list_reference_docs(db, subject_slug="geography", form_level=2, doc_type="scheme_of_work")
        assert len(geo_f2_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in geo_f2_schemes)
        geo_f2_lessons = list_reference_docs(db, subject_slug="geography", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(geo_f2_lessons) == 80
        assert all(doc.source_id.startswith("bundled:") for doc in geo_f2_lessons)

        sw_twos = list_reference_docs(db, subject_slug="kiswahili", form_level=2, doc_type="scheme_of_work")
        assert len(sw_twos) == 2 and all(doc.source_id.startswith("bundled:") for doc in sw_twos)

        # After the purge, grounding sees only bundled candidates (no mixing).
        ground = fetch_reference_grounding("geography", 1, "LESSON PLAN FOR GEOGRAPHY FORM ONE", "lesson_plan")
        assert ground["source_id"].startswith("bundled:")
        again_geo = list_reference_docs(db, subject_slug="geography", form_level=1)
        assert len(again_geo) == 20
        assert all(doc.source_id.startswith("bundled:") for doc in again_geo)
    finally:
        db.close()