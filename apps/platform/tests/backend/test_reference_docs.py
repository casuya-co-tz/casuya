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
    fetch_reference_grounding,
    get_reference_doc,
    lesson_plan_grounding,
    list_reference_docs,
    map_form_level,
    map_subject_slug,
    parse_metadata,
    scheme_of_work_grounding,
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


# ---------- Bundled (verified) seed + grounding ----------

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
    52 lesson plans + 2 term schemes."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        inserted, replaced, inserted_schemes, replaced_schemes, purged = seed_reference_library_local.run(db)
        assert inserted == 647  # 98 geography (18 f1 + 80 f2) + 60 history f1 + 47 mathematics f2 + 24 chemistry f2 + 24 biology f2 + 21 english + 13 history f2 + 21 historia_tanzania_maadili + 21 business_studies f2 + 21 kiswahili + 50 physics form one + 52 physics form two + 20 chemistry f1 + 30 biology f1 + 30 mathematics f1 + 52 business_studies form one + 39 english form one term i lessons + 24 english form one term ii lessons
        assert replaced == 0
        assert inserted_schemes == 33
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
        # Form One: Chemistry (20 lessons, 1 scheme), Biology (30 lessons, 2 schemes), Mathematics (30 lessons, 2 schemes)
        chem_f1_lessons = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(chem_f1_lessons) == 20
        chem_f1_schemes = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="scheme_of_work")
        assert len(chem_f1_schemes) == 1

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
        for slug in ("history_civics", "business_studies", "english", "kiswahili"):
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
        check_f2_lessons = {
            "mathematics": 47,
            "chemistry": 24,
            "biology": 24,
            "english": 21,
            "history": 13,
            "history_civics": 21,
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


def test_scheme_grounding_selects_verified_term_rows():
    """Term selection resolves to the right bundled scheme, and its per-week
    rows carry the verified competences, strategies, resources, assessment
    tools and non-teaching placeholders in normalized form."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    term_one = fetch_reference_grounding("geography", 1, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert rows
    first = rows[0]
    assert first["topic"] == "Introduction to Geography"
    assert first["main_competence"] == "1.0 Demonstrate mastery of foundational geographical concepts"
    assert first["main_activity"] == "Explain the concept of Geography"
    assert "Interactive lecture" in first["methods"]
    assert first["assessment"] == "Observation, Oral Questions, Portfolio"
    midterms = [r for r in rows if r["non_teaching"]]
    assert len(midterms) == 2
    assert midterms[0]["topic"] == "Mid-Term Assessment"

    term_two = fetch_reference_grounding("geography", 1, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    assert gl_two["rows"][0]["topic"] == "Weather and Climate"
    assert gl_two["rows"][0]["specific_competence"].startswith("3.1")


def test_scheme_grounding_form_two_selects_verified_term_rows():
    """Geography Form Two term selection resolves to the bundled verified Term
    I (internal/external Earth structure) and Term II (map & photograph reading)
    schemes, with the educator's strategies, resources and assessment tools
    carried verbatim into the normalized rows."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    term_one = fetch_reference_grounding("geography", 2, "term 1", "scheme_of_work")
    assert term_one is not None
    assert "TERM 1" in term_one["title"]
    assert term_one["source_id"].startswith("bundled:")
    gl = scheme_of_work_grounding(term_one["content"])
    rows = gl["rows"]
    assert len(rows) == 19  # 17 teaching + mid-term + terminal
    first = rows[0]
    assert first["topic"] == "The Internal Structure of the Earth"
    assert first["main_competence"] == "1.0 Demonstrate mastery of the Earth's internal structure and landform processes"
    assert first["specific_competence"].startswith("1.1 Describe the layers")
    assert first["main_activity"] == "Explain the concept of the internal structure of the Earth"
    assert first["specific_activity"] == "Describe the Crust, Mantle, and Core (3 lessons)"
    assert first["periods"] == "3"
    assert "group reading of TIE textbook" in first["methods"]
    assert first["assessment"] == "Diagram labeling, Oral questions"
    assert "globe" in first["resources"]
    non = [r for r in rows if r["non_teaching"]]
    assert len(non) == 2
    assert non[0]["topic"] == "Mid-Term Assessment"
    assert non[1]["topic"] == "Terminal Examination"

    term_two = fetch_reference_grounding("geography", 2, "term 2", "scheme_of_work")
    assert term_two is not None
    assert "TERM 2" in term_two["title"]
    gl_two = scheme_of_work_grounding(term_two["content"])
    head = gl_two["rows"][0]
    assert head["topic"] == "Map Reading and Interpretation"
    assert head["specific_competence"] == "3.1 Apply essential elements and characteristics of good maps"
    assert head["assessment"] == "Element audit checklist, Oral quiz"
    assert any(r["topic"] == "Photograph Reading and Interpretation" for r in gl_two["rows"])
    assert len([r for r in gl_two["rows"] if r["non_teaching"]]) == 3


def test_fetch_grounding_selects_verified_bundled_lesson():
    """Grounding for the 'Concept of Geography' topic resolves to the exact
    bundled lesson 1.1 (title match beats chapter content matches), and its
    four-stage progression is extracted with a positive match flag."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    ground = fetch_reference_grounding("geography", 1, "Concept of Geography", "lesson_plan")
    assert ground is not None
    assert "1.1: CONCEPT OF GEOGRAPHY" in ground["title"]
    assert ground["source_id"].startswith("bundled:")

    gl = lesson_plan_grounding(ground["content"], match_hint="Concept of Geography")
    assert gl["matched"] is True
    assert gl["main_competence"] == "1.0 Demonstrate mastery of foundational geographical concepts"
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["teacher_activity"].startswith(
        "Asks learners to describe what they see")
    assert gl["progression"][0]["learner_activity"].startswith(
        "List physical features and human activities observed")
    assert gl["progression"][1]["assessment_criteria"].startswith(
        "Learners define Geography accurately")


def test_fetch_grounding_selects_verified_bundled_form_two_lesson():
    """Grounding for a Form Two topic resolves to the exact bundled educator
    lesson (e.g. lesson 1 'Internal Structure of the Earth'), and the review
    and human-geography lessons (41, 80) are also reachable in the bundle."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    ground = fetch_reference_grounding("geography", 2, "Internal Structure of the Earth", "lesson_plan")
    assert ground is not None
    assert "NO. 1" in ground["title"]
    assert ground["source_id"].startswith("bundled:")
    assert ground["standard"] == "Form 2"

    gl = lesson_plan_grounding(ground["content"], match_hint="Internal Structure of the Earth")
    assert gl["matched"] is True
    assert gl["specific_competence"].startswith("1.1")
    assert len(gl["progression"]) == 4
    assert gl["progression"][0]["stage"].lower() == "introduction"
    assert "egg" in gl["progression"][0]["teacher_activity"].lower()

    human = fetch_reference_grounding("geography", 2, "Introduction to Human Activities", "lesson_plan")
    assert human is not None
    assert "NO. 41" in human["title"]

    review = fetch_reference_grounding("geography", 2, "Comprehensive Review of Form Two Geography", "lesson_plan")
    assert review is not None
    assert "NO. 80" in review["title"]
    nonmatch = fetch_reference_grounding("geography", 2, "Quantum Mechanics", "lesson_plan")
    if nonmatch is not None:
        assert lesson_plan_grounding(nonmatch["content"], match_hint="Quantum Mechanics")["matched"] is False


def test_fetch_grounding_no_match_stays_negative():
    """A topic with no bundled geography lesson is not matched, so generators
    never ground on an unrelated verified lesson."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        seed_reference_library_local.run(db)
    finally:
        db.close()

    ground = fetch_reference_grounding("geography", 1, "States of Matter", "lesson_plan")
    if ground is None:
        return
    gl = lesson_plan_grounding(ground["content"], match_hint="States of Matter")
    assert gl["matched"] is False


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
