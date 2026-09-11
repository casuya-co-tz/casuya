"""Full platform reseed: delete the old, introduce the new.

Replaces whatever is currently in the database with the current 3-subject
curriculum (Mathematics, Chemistry, Physics):

1. **Purge** — delete every row that references a subject outside the kept
   scope, across all subject-tagged tables:
   - ``syllabus_subjects`` (cascades topics/subtopics/learning outcomes)
   - admin lesson-catalog ``subjects`` (cascades topics/subtopics)
   - ``reference_docs`` tagged with a removed slug (or an unmapped/NULL slug)
   - ``teacher_plans`` tagged with a removed slug (defensive; none today)
2. **Introduce** — run the authoritative seeds in dependency order. Each seed
   is wipe-and-replace *inside the active form window* (Form I-II by default):
   every existing in-window topic/subtopic is deleted first, then the current
   official set (and any lessons referencing the removed subtopics, with their
   dependents) is inserted. Existing Form III-VI rows are never touched by any
   seed step or by the purge; they stay until the window is explicitly widened
   (``--forms``).
   - ``seed_necta_syllabus``  -> ``syllabus_*`` (official TIE topics/outcomes)
   - ``seed_admin_math``      -> admin ``subjects``/``topics``/``subtopics``
   - ``seed_reference_library_local`` -> bundled lesson plans + schemes

Strict table references (lessons, progress) are untouched: they never attach
to removed subjects. ``--demo`` additionally runs the dev-data seed
(demo accounts + sample lesson/game/quiz); it is a no-op on non-empty DBs.

Usage (from the repo -- the ``database`` package must be importable):

    python -m database.seeds.reseed                    # forms I-II only
    python -m database.seeds.reseed --forms 1-4        # widen the form window
    python -m database.seeds.reseed --demo             # + demo accounts/content
    python -m database.seeds.reseed --keep-unmapped    # retain NULL-slug ref docs
"""

from __future__ import annotations

import sys

from backend.config.database import get_db, init_db
from backend.models.lesson import Subject
from backend.models.reference_doc import ReferenceDoc
from backend.models.syllabus import SyllabusSubject
from backend.models.teacher_plan import TeacherPlan

from .seed_necta_syllabus import NECTA_SYLLABUS, SEED_FORM_MAX, SEED_FORM_MIN


def kept_slugs() -> set[str]:
    """The slugs this reseed keeps: exactly what the current seed defines.

    Today that is the 3-subject scope (Mathematics, Chemistry, Physics)
    derived from ``data/*.json`` so the scope always matches the seed data.
    """
    return {entry["slug"] for entry in NECTA_SYLLABUS}


def purge_out_of_scope(
    db,
    *,
    keep_unmapped: bool = False,
) -> dict[str, int]:
    """Delete everything that references a subject outside the kept scope.

    Returns ``{table: rows_deleted}`` for reporting. ``SyllabusSubject``
    deletes cascade through its ORM relationships (topics -> subtopics ->
    outcomes). The admin catalog models carry no relationships or reliable
    DB-level ``ON DELETE CASCADE``, so their children are removed first
    (subtopics -> topics -> subjects) in explicit order. Reference docs and
    teacher plans are filtered directly by slug.
    """
    from backend.models.lesson import Lesson, Subtopic, Topic

    scope = kept_slugs()
    deleted: dict[str, int] = {}

    syllabus_removed = (
        db.query(SyllabusSubject).filter(~SyllabusSubject.slug.in_(scope)).all()
    )
    deleted["syllabus_subjects"] = len(syllabus_removed)
    for subject in syllabus_removed:
        db.delete(subject)

    removed_ids = [s.id for s in db.query(Subject).filter(~Subject.slug.in_(scope)).all()]
    deleted["catalog_subjects"] = len(removed_ids)
    if removed_ids:
        topic_ids = [
            r[0]
            for r in db.query(Topic.id).filter(Topic.subject_id.in_(removed_ids)).all()
        ]
        if topic_ids:
            orphan_lessons = (
                db.query(Lesson).filter(Lesson.subtopic_id.in_(
                    db.query(Subtopic.id).filter(Subtopic.topic_id.in_(topic_ids))
                )).count()
            )
            if orphan_lessons:
                raise RuntimeError(
                    f"{orphan_lessons} lessons reference removed-subject subtopics; "
                    "delete or re-home them before reseeding"
                )
            db.query(Subtopic).filter(Subtopic.topic_id.in_(topic_ids)).delete(
                synchronize_session=False
            )
            db.query(Topic).filter(Topic.id.in_(topic_ids)).delete(
                synchronize_session=False
            )
        db.query(Subject).filter(Subject.id.in_(removed_ids)).delete(
            synchronize_session=False
        )

    ref_filter = ~ReferenceDoc.subject_slug.in_(scope)
    if not keep_unmapped:
        ref_filter = ref_filter | ReferenceDoc.subject_slug.is_(None)
    deleted["reference_docs"] = db.query(ReferenceDoc).filter(ref_filter).delete()

    plans_filter = ~TeacherPlan.subject_slug.in_(scope)
    deleted["teacher_plans"] = db.query(TeacherPlan).filter(plans_filter).delete()

    db.commit()
    return deleted


def _report_deletions(deleted: dict[str, int]) -> None:
    print("  Purged out-of-scope rows (kept scope: Mathematics, Chemistry, Physics):")
    for table, count in deleted.items():
        print(f"    {table}: {count}")
    if not any(deleted.values()):
        print("    (nothing to purge)")


def _counts(db) -> None:
    """Print table sizes for the kept scope after a reseed."""
    from backend.models.lesson import Subject
    from backend.models.reference_doc import ReferenceDoc
    from backend.models.syllabus import (
        LearningOutcome,
        SyllabusSubject,
        SyllabusSubtopic,
        SyllabusTopic,
    )

    scope = kept_slugs()
    for table, q in (
        ("syllabus_subjects", db.query(SyllabusSubject)),
        ("syllabus_topics", db.query(SyllabusTopic)),
        ("syllabus_subtopics", db.query(SyllabusSubtopic)),
        ("learning_outcomes", db.query(LearningOutcome)),
        ("catalog subjects", db.query(Subject)),
        ("reference_docs", db.query(ReferenceDoc).filter(ReferenceDoc.subject_slug.in_(scope))),
    ):
        print(f"    {table}: {q.count()}")


def run(
    *,
    demo: bool = False,
    keep_unmapped: bool = False,
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> None:
    init_db()
    db = next(get_db())
    try:
        print("== Reseed: purge the old ==")
        deleted = purge_out_of_scope(db, keep_unmapped=keep_unmapped)
        _report_deletions(deleted)

        print()
        print(f"== Reseed: introduce the new (forms {form_min}-{form_max}) ==")
        from . import seed_necta_syllabus
        from . import seed_admin_math
        from . import seed_reference_library_local

        print("  [1/3] NECTA/TIE syllabus (syllabus_* tables)")
        seed_necta_syllabus.run(form_min=form_min, form_max=form_max)
        print("  [2/3] Admin lesson catalog (subjects/topics/subtopics)")
        seed_admin_math.seed_all(form_min=form_min, form_max=form_max)
        print("  [3/3] Bundled reference library (reference_docs)")
        seed_reference_library_local.run(db)

        if demo:
            print()
            print("  [demo] Dev data (accounts/sample content)")
            from . import seed_dev_data

            seed_dev_data.run()

        print()
        print("== Reseed finished ==")
        _counts(db)
    finally:
        db.close()


def main() -> None:
    args = set(sys.argv[1:])
    form_min, form_max = SEED_FORM_MIN, SEED_FORM_MAX
    forms_arg = next((a for a in sys.argv[1:] if a.startswith("--forms=")), None)
    if forms_arg:
        try:
            parts = forms_arg.split("=", 1)[1].split("-")
            form_min, form_max = int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            raise SystemExit("usage: --forms MIN-MAX e.g. --forms=1-2 (or --forms 1-4)")
    run(
        demo="--demo" in args,
        keep_unmapped="--keep-unmapped" in args,
        form_min=form_min,
        form_max=form_max,
    )


if __name__ == "__main__":
    main()