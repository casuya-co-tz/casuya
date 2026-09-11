"""Populate the admin lesson-catalog (subjects/topics/subtopics) with the full
NECTA/TIE curriculum.

The admin ``#subjects``, ``#topics`` and ``#subtopics`` pages read from the
simple lesson-catalog tables (``subjects``/``topics``/``subtopics`` in
``backend.models.lesson``), which are separate from the ``syllabus_*`` tables
used by the AI agent. This seed maps the official NECTA subjects, topics and
subtopics (O-Level and A-Level) into those admin-facing tables so the admin
shows the real curriculum.

Wipe-and-replace inside the active form window (Form I-II by default): every
existing in-window topic/subtopic is deleted before the official set is
inserted, so the catalog always matches the seed exactly; lessons hanging off
removed subtopics (and their dependents) are deleted too. Topics in higher
forms and lessons outside the window are left untouched. Safe to re-run
against local and production.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from backend.config.database import get_db, init_db
from backend.middleware.cache import cache_invalidate
from backend.models.lesson import Subject, Subtopic, Topic

from .seed_necta_syllabus import NECTA_SYLLABUS, SEED_FORM_MIN, SEED_FORM_MAX

ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


def _uuid() -> str:
    return str(uuid.uuid4())


def _delete_in_window_topics(
    db: Session,
    subject: Subject,
    form_min: int,
    form_max: int,
) -> tuple[int, int, int]:
    """Delete every topic/subtopic in the form window for one admin subject.

    Seeding is wipe-and-replace: all topics inside ``[form_min, form_max]``
    are removed so the catalog exactly matches the official seed afterwards.
    Lessons attached to those subtopics — and everything that references them
    (quizzes, games, assignments, progress, bookmarks, notes, activity,
    analytics, versions) — are removed too, since the DB has no cascades.
    Returns (topics_removed, subtopics_removed, lessons_removed).
    """
    from backend.models.lesson import Lesson, Topic

    window_forms = {ROMAN[f] for f in range(form_min, form_max + 1)}
    topics = (
        db.query(Topic)
        .filter(
            Topic.subject_id == subject.id,
            Topic.form_level.in_(window_forms),
        )
        .all()
    )
    if not topics:
        return 0, 0, 0
    topic_ids = [t.id for t in topics]
    sub_ids = [
        r[0]
        for r in db.query(Subtopic.id).filter(Subtopic.topic_id.in_(topic_ids)).all()
    ]
    lesson_ids = [
        r[0]
        for r in db.query(Lesson.id).filter(Lesson.subtopic_id.in_(sub_ids)).all()
    ]

    if lesson_ids:
        _delete_lessons_with_dependents(db, lesson_ids)
    if sub_ids:
        db.query(Subtopic).filter(Subtopic.topic_id.in_(topic_ids)).delete(
            synchronize_session=False
        )
    db.query(Topic).filter(Topic.id.in_(topic_ids)).delete(
        synchronize_session=False
    )
    return len(topic_ids), len(sub_ids), len(lesson_ids)


def _delete_lessons_with_dependents(db: Session, lesson_ids: list[str]) -> None:
    """Delete lessons and every row that references them (dependency order).

    The lesson tables carry no DB-level cascades, so dependents are removed
    explicitly: quiz options/questions, quizzes, games, assignments (+
    submissions), progress, bookmarks, notes, activity, analytics, versions.
    """
    from backend.models.activity import RecentActivity
    from backend.models.analytics import LessonAnalyticsSnapshot
    from backend.models.assignment import Assignment, AssignmentSubmission
    from backend.models.bookmark import Bookmark
    from backend.models.game import Game
    from backend.models.lesson import Lesson
    from backend.models.lesson_version import LessonVersion
    from backend.models.note import Note
    from backend.models.progress import ProgressRecord
    from backend.models.quiz import Quiz, QuizQuestion, QuizOption

    quiz_ids = [
        r[0]
        for r in db.query(Quiz.id).filter(Quiz.lesson_id.in_(lesson_ids)).all()
    ]
    if quiz_ids:
        question_ids = [
            r[0]
            for r in db.query(QuizQuestion.id)
            .filter(QuizQuestion.quiz_id.in_(quiz_ids))
            .all()
        ]
        if question_ids:
            db.query(QuizOption).filter(
                QuizOption.question_id.in_(question_ids)
            ).delete(synchronize_session=False)
        db.query(QuizQuestion).filter(
            QuizQuestion.quiz_id.in_(quiz_ids)
        ).delete(synchronize_session=False)
    db.query(Quiz).filter(Quiz.lesson_id.in_(lesson_ids)).delete(
        synchronize_session=False
    )
    db.query(Game).filter(Game.lesson_id.in_(lesson_ids)).delete(
        synchronize_session=False
    )

    assignment_ids = [
        r[0]
        for r in db.query(Assignment.id)
        .filter(Assignment.lesson_id.in_(lesson_ids))
        .all()
    ]
    if assignment_ids:
        db.query(AssignmentSubmission).filter(
            AssignmentSubmission.assignment_id.in_(assignment_ids)
        ).delete(synchronize_session=False)
        db.query(Assignment).filter(Assignment.id.in_(assignment_ids)).delete(
            synchronize_session=False
        )

    for model in (
        Bookmark,
        LessonAnalyticsSnapshot,
        LessonVersion,
        Note,
        ProgressRecord,
        RecentActivity,
    ):
        db.query(model).filter(model.lesson_id.in_(lesson_ids)).delete(
            synchronize_session=False
        )
    db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).delete(
        synchronize_session=False
    )


def _seed_entry(
    db: Session,
    entry: dict,
    codes: set[str],
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> tuple[int, int, int, int]:
    """Seed one NECTA subject's topics/subtopics into the admin catalog.

    ``codes`` restricts which syllabus entries are handled (empty set = all).
    Seeding is wipe-and-replace inside ``[form_min, form_max]``: every
    existing in-window topic/subtopic (and any lessons referencing them, with
    their dependents) is deleted first, then the official set is inserted.
    Forms outside the window are left untouched. Returns
    (topics_created, total_topics, total_subtopics, topics_removed).
    """
    if codes and entry["code"] not in codes:
        return (0, 0, 0, 0)

    subject = db.query(Subject).filter(Subject.slug == entry["slug"]).first()
    if subject is None:
        subject = Subject(name=entry["name"], slug=entry["slug"])
        db.add(subject)
        db.flush()

    removed = _delete_in_window_topics(db, subject, form_min, form_max)

    created = 0
    for topic_data in entry.get("topics", []):
        form_int = topic_data.get("form_level", 1)
        if not (form_min <= form_int <= form_max):
            continue
        form = ROMAN.get(form_int, "I")
        title = topic_data["title"]
        existing = (
            db.query(Topic)
            .filter(
                Topic.subject_id == subject.id,
                Topic.title == title,
                Topic.form_level == form,
            )
            .first()
        )
        if existing is not None:
            topic = existing
        else:
            topic = Topic(
                id=_uuid(),
                subject_id=subject.id,
                title=title,
                form_level=form,
            )
            db.add(topic)
            db.flush()
            created += 1

        for sub_data in topic_data.get("subtopics", []):
            sub_title = sub_data["title"]
            has_sub = (
                db.query(Subtopic)
                .filter(Subtopic.topic_id == topic.id, Subtopic.title == sub_title)
                .first()
                is not None
            )
            if not has_sub:
                db.add(
                    Subtopic(
                        id=_uuid(),
                        topic_id=topic.id,
                        title=sub_title,
                    )
                )
        db.flush()

    total_topics = db.query(Topic).filter(Topic.subject_id == subject.id).count()
    total_subtopics = (
        db.query(Subtopic)
        .join(Topic, Subtopic.topic_id == Topic.id)
        .filter(Topic.subject_id == subject.id)
        .count()
    )
    return (created, total_topics, total_subtopics, removed)


def run_math(
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> int:
    """Seed Mathematics topics/subtopics into the admin lesson-catalog.

    Only topics inside the ``[form_min, form_max]`` form window are seeded
    (Form I-II by default). Returns the total number of topics created.
    """
    init_db()
    db: Session = next(get_db())
    try:
        created_total = 0
        for entry in NECTA_SYLLABUS:
            if entry["code"] in ("MATH", "AMATH"):
                created, topics, sub_topics, removed = _seed_entry(
                    db, entry, set(), form_min=form_min, form_max=form_max
                )
                created_total += created
                removed_topics, removed_subs, removed_lessons = removed
                print(f"  {entry['name']}: {topics} topics, {sub_topics} subtopics in admin catalog ({created} new, {removed_subs} subtopics / {removed_lessons} lessons removed).")
        db.commit()

        # Invalidate any cached admin list responses so the UI reflects new data.
        for pat in (None, "subjects:", "topics:", "subtopics:"):
            cache_invalidate(pat)
        return created_total
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def seed_all(
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> int:
    """Seed every NECTA/TIE subject's topics/subtopics into the admin catalog.

    Only topics inside the ``[form_min, form_max]`` form window are seeded
    (Form I-II by default); higher forms are untouched. Returns the total
    number of topics created across all subjects.
    """
    init_db()
    db: Session = next(get_db())
    try:
        created_total = 0
        for entry in NECTA_SYLLABUS:
            try:
                created, topics, sub_topics, removed = _seed_entry(
                    db, entry, set(), form_min=form_min, form_max=form_max
                )
                created_total += created
                removed_topics, removed_subs, removed_lessons = removed
                db.commit()
                print(f"  {entry['name']} ({entry['code']}): {topics} topics, {sub_topics} subtopics in admin catalog ({created} new, {removed_subs} subtopics / {removed_lessons} lessons removed).")
            except Exception:
                db.rollback()
                raise

        db.commit()

        # Invalidate any cached admin list responses so the UI reflects new data.
        for pat in (None, "subjects:", "topics:", "subtopics:"):
            cache_invalidate(pat)
        return created_total
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def run() -> None:
    """CLI entrypoint that seeds the admin lesson-catalog for all subjects."""
    seed_all()


if __name__ == "__main__":
    run()