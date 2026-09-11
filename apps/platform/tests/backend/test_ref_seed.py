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
    inserts and replaces nothing. Only Mathematics, Chemistry and Physics
    bundled docs exist."""
    from database.seeds import seed_reference_library_local

    db = next(get_db())
    try:
        inserted, replaced, inserted_schemes, replaced_schemes, purged = seed_reference_library_local.run(db)
        assert inserted == 223
        assert replaced == 0
        assert inserted_schemes == 12
        assert replaced_schemes == 0
        assert purged == 0
        # Physics Form One: 50 lesson plans (26 Term I + 24 Term II) + 2 term schemes
        physics_f1_lessons = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(physics_f1_lessons) == 50
        assert all(doc.source_id.startswith("bundled:") for doc in physics_f1_lessons)
        physics_f1_schemes = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="scheme_of_work")
        assert len(physics_f1_schemes) == 2
        # Physics Form Two: 52 lesson plans (26 Term I + 26 Term II) + 2 term schemes
        physics_f2_lessons = list_reference_docs(db, subject_slug="physics", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(physics_f2_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in physics_f2_lessons)
        physics_schemes = list_reference_docs(db, subject_slug="physics", form_level=2, doc_type="scheme_of_work")
        assert len(physics_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in physics_schemes)
        # Chemistry Form One: 20 lesson plans + 2 schemes
        chem_f1_lessons = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(chem_f1_lessons) == 20
        chem_f1_schemes = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="scheme_of_work")
        assert len(chem_f1_schemes) == 2
        # Chemistry Form Two: 24 lesson plans + 2 schemes
        chem_f2_lessons = list_reference_docs(db, subject_slug="chemistry", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(chem_f2_lessons) == 24
        chem_f2_schemes = list_reference_docs(db, subject_slug="chemistry", form_level=2, doc_type="scheme_of_work")
        assert len(chem_f2_schemes) == 2
        # Mathematics Form One: 30 lesson plans + 2 schemes
        math_f1_lessons = list_reference_docs(db, subject_slug="mathematics", form_level=1, doc_type="lesson_plan", limit=200)
        assert len(math_f1_lessons) == 30
        math_f1_schemes = list_reference_docs(db, subject_slug="mathematics", form_level=1, doc_type="scheme_of_work")
        assert len(math_f1_schemes) == 2
        # Mathematics Form Two: 47 lesson plans + 2 schemes
        math_f2_lessons = list_reference_docs(db, subject_slug="mathematics", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(math_f2_lessons) == 47
        math_f2_schemes = list_reference_docs(db, subject_slug="mathematics", form_level=2, doc_type="scheme_of_work")
        assert len(math_f2_schemes) == 2
        # All subjects have bundled source ids
        for slug in ("mathematics", "chemistry", "physics"):
            for form in (1, 2):
                f_schemes = list_reference_docs(db, subject_slug=slug, form_level=form, doc_type="scheme_of_work")
                assert len(f_schemes) == 2, (slug, form)
                assert all(doc.source_id.startswith("bundled:") for doc in f_schemes)
        # Idempotent re-run
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
    record even when no bundled docs exist for that slot."""
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
        fake("lesson_plan", "55", "LESSON PLAN FOR PHYSICS FORM ONE 2026", "physics", 1, "Form 1")
        fake("lesson_plan", "174", "LESSON PLAN FOR PHYSICS FORM ONE-2026", "physics", 1, "Form 1")
        fake("lesson_plan", "200", "LESSON PLAN FOR PHYSICS FORM ONE 2026", "physics", 1, "Form 1")
        # A chemistry pair (should stay untouched — normalised titles differ)
        fake("lesson_plan", "300", "LESSON PLAN FOR CHEMISTRY FORM ONE", "chemistry", 1, "Form 1")
        fake("lesson_plan", "301", "LESSON PLAN FOR CHEMISTRY FORM ONE 2026", "chemistry", 1, "Form 1")
        db.commit()

        purged = _deduplicate_online_docs(db)
        db.commit()

        # 3 physics duplicates (55, 174, 200) → keep 200, purge 55+174 = 2
        # chemistry pair normalise differently ("form one" vs "form one 2026") → 0
        assert purged == 2

        phy_f1 = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="lesson_plan")
        online_f1 = [d for d in phy_f1 if not d.source_id.startswith("bundled:")]
        assert len(online_f1) == 1
        assert online_f1[0].source_id == "200"
        assert "2026" in online_f1[0].title

        chem_f1 = list_reference_docs(db, subject_slug="chemistry", form_level=1, doc_type="lesson_plan")
        assert len(chem_f1) == 2  # not deduped — different normalised titles
    finally:
        db.close()


def test_bundled_seed_purges_conflicting_online_duplicates():
    """When the online catalog has already seeded conflicting Physics Form
    One copies (duplicate lesson plans 55/174, a noisy scheme 295 and a
    mislabelled 'Afya na Mazingira' Standard 1 lesson mis-mapped to physics),
    re-running the bundled seed removes them so the library keeps ONLY the
    verified bundle for that subject/form/type. A Chemistry Form Two scheme
    imported from the online catalog is also purged now that the bundled
    Chemistry scheme owns that slot."""
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

        fake("lesson_plan", "55", "LESSON PLAN FOR PHYSICS FORM ONE", "physics", 1, "Form 1")
        fake("lesson_plan", "174", "LESSON PLAN FOR PHYSICS FORM ONE-2026", "physics", 1, "Form 1")
        fake("lesson_plan", "133", "MPANGO KAZI WA AFYA NA MAZINGIRA DARASA LA KWANZA", "physics", 1, "Standard 1")
        fake("lesson_plan", "557", "LESSON PLAN FOR PHYSICS FORM ONE 2026", "physics", 1, "Form 1")
        fake("scheme_of_work", "295", "PMO-RALG PHYSICS SCHEME OF WORK-FORM ONE", "physics", 1, "Form 1")
        fake("scheme_of_work", "555", "PHYSICS SCHEME OF WORK-FORM TWO", "physics", 2, "Form 2")
        fake("lesson_plan", "556", "LESSON PLAN FOR PHYSICS FORM TWO-2026", "physics", 2, "Form 2")
        fake("scheme_of_work", "999", "CHEMISTRY SCHEME FORM TWO", "chemistry", 2, "Form 2")
        db.commit()

        _, _, _, _, purged = seed_reference_library_local.run(db)
        # 4 physics F1 lesson plans (55, 174, 133, 557) + 1 F1 scheme (295)
        # + 1 F2 scheme (555) + 1 F2 lesson plan (556) + 1 Chemistry F2 scheme
        # (999, now owned by the bundled Chemistry scheme) = 8
        assert purged == 8

        phy_lessons = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="lesson_plan")
        assert len(phy_lessons) == 50
        assert all(doc.source_id.startswith("bundled:") for doc in phy_lessons)
        phy_schemes = list_reference_docs(db, subject_slug="physics", form_level=1, doc_type="scheme_of_work")
        assert len(phy_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in phy_schemes)
        phy_f2_schemes = list_reference_docs(db, subject_slug="physics", form_level=2, doc_type="scheme_of_work")
        assert len(phy_f2_schemes) == 2
        assert all(doc.source_id.startswith("bundled:") for doc in phy_f2_schemes)
        phy_f2_lessons = list_reference_docs(db, subject_slug="physics", form_level=2, doc_type="lesson_plan", limit=200)
        assert len(phy_f2_lessons) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in phy_f2_lessons)

        chem_twos = list_reference_docs(db, subject_slug="chemistry", form_level=2, doc_type="scheme_of_work")
        assert len(chem_twos) == 2 and all(doc.source_id.startswith("bundled:") for doc in chem_twos)

        # After the purge, grounding sees only bundled candidates (no mixing).
        ground = fetch_reference_grounding("physics", 1, "LESSON PLAN FOR PHYSICS FORM ONE", "lesson_plan")
        assert ground["source_id"].startswith("bundled:")
        again_phy = list_reference_docs(db, subject_slug="physics", form_level=1, limit=200)
        assert len(again_phy) == 52
        assert all(doc.source_id.startswith("bundled:") for doc in again_phy)
    finally:
        db.close()
