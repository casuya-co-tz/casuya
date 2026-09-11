"""Populate the admin lesson-catalog (subjects/topics/subtopics) with the full
NECTA/TIE curriculum.

The admin ``#subjects``, ``#topics`` and ``#subtopics`` pages read from the
simple lesson-catalog tables (``subjects``/``topics``/``subtopics`` in
``backend.models.lesson``), which are separate from the ``syllabus_*`` tables
used by the AI agent. This seed maps the official NECTA subjects, topics and
subtopics (O-Level and A-Level) into those admin-facing tables so the admin
shows the real curriculum.

Additive & idempotent: subjects/topics/subtopics already present are skipped,
and existing rows with downstream references (lessons, progress) are never
deleted. Safe to re-run against local and production.
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


def _seed_entry(
    db: Session,
    entry: dict,
    codes: set[str],
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> tuple[int, int, int, int]:
    """Seed one NECTA subject's topics/subtopics into the admin catalog.

    ``codes`` restricts which syllabus entries are handled (empty set = all).
    Only topics whose form level is inside ``[form_min, form_max]`` are seeded;
    higher forms are left untouched. In-window topics absent from the official
    seed (stale leftovers from older data) are pruned unless a lesson
    references them — referenced topics are always kept so downstream rows are
    never orphaned. Returns
    (topics_created, total_topics, total_subtopics, topics_pruned) for the
    subject.
    """
    if codes and entry["code"] not in codes:
        return (0, 0, 0, 0)

    subject = db.query(Subject).filter(Subject.slug == entry["slug"]).first()
    if subject is None:
        subject = Subject(name=entry["name"], slug=entry["slug"])
        db.add(subject)
        db.flush()

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

    # Prune stale in-window leftovers (topics from older seed data that are no
    # longer part of the official syllabus) unless a lesson references the
    # topic's subtopics -- referenced topics are always kept intact.
    from backend.models.lesson import Lesson

    official = {
        (t["title"], t.get("form_level", 1))
        for t in entry.get("topics", [])
        if form_min <= t.get("form_level", 1) <= form_max
    }
    reverse_roman = {roman: num for num, roman in ROMAN.items()}
    window_forms = {ROMAN[f] for f in range(form_min, form_max + 1)}
    pruned = 0
    db_topics = (
        db.query(Topic)
        .filter(
            Topic.subject_id == subject.id,
            Topic.form_level.in_(window_forms),
        )
        .all()
    )
    for topic in db_topics:
        if (topic.title, reverse_roman[topic.form_level]) in official:
            continue
        sub_ids = [
            r[0]
            for r in db.query(Subtopic.id)
            .filter(Subtopic.topic_id == topic.id)
            .all()
        ]
        referenced = (
            db.query(Lesson).filter(Lesson.subtopic_id.in_(sub_ids)).first()
            is not None
            if sub_ids
            else False
        )
        if referenced:
            continue
        if sub_ids:
            db.query(Subtopic).filter(Subtopic.topic_id == topic.id).delete(
                synchronize_session=False
            )
        db.delete(topic)
        pruned += 1

    total_topics = db.query(Topic).filter(Topic.subject_id == subject.id).count()
    total_subtopics = (
        db.query(Subtopic)
        .join(Topic, Subtopic.topic_id == Topic.id)
        .filter(Topic.subject_id == subject.id)
        .count()
    )
    return (created, total_topics, total_subtopics, pruned)


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
                created, topics, sub_topics, pruned = _seed_entry(
                    db, entry, set(), form_min=form_min, form_max=form_max
                )
                created_total += created
                print(f"  {entry['name']}: {topics} topics, {sub_topics} subtopics in admin catalog ({created} new topics, {pruned} pruned).")
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
                created, topics, sub_topics, pruned = _seed_entry(
                    db, entry, set(), form_min=form_min, form_max=form_max
                )
                created_total += created
                db.commit()
                print(f"  {entry['name']} ({entry['code']}): {topics} topics, {sub_topics} subtopics in admin catalog ({created} new topics, {pruned} pruned).")
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