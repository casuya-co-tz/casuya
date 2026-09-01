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

from .seed_necta_syllabus import NECTA_SYLLABUS

ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


def _uuid() -> str:
    return str(uuid.uuid4())


def _seed_entry(db: Session, entry: dict, codes: set[str]) -> tuple[int, int, int]:
    """Seed one NECTA subject's topics/subtopics into the admin catalog.

    ``codes`` restricts which syllabus entries are handled (empty set = all).
    Returns (topics_created, total_topics, total_subtopics) for the subject.
    """
    if codes and entry["code"] not in codes:
        return (0, 0, 0)

    subject = db.query(Subject).filter(Subject.slug == entry["slug"]).first()
    if subject is None:
        subject = Subject(name=entry["name"], slug=entry["slug"])
        db.add(subject)
        db.flush()

    created = 0
    for topic_data in entry.get("topics", []):
        form = ROMAN.get(topic_data.get("form_level", 1), "I")
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
    return (created, total_topics, total_subtopics)


def run_math() -> int:
    """Seed Mathematics topics/subtopics into the admin lesson-catalog.

    Returns the total number of topics created.
    """
    init_db()
    db: Session = next(get_db())
    try:
        created_total = 0
        for entry in NECTA_SYLLABUS:
            if entry["code"] in ("MATH", "AMATH"):
                created, topics, sub_topics = _seed_entry(db, entry, set())
                created_total += created
                print(f"  {entry['name']}: {topics} topics, {sub_topics} subtopics in admin catalog ({created} new topics).")
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


def seed_all() -> int:
    """Seed every NECTA/TIE subject's topics/subtopics into the admin catalog.

    Returns the total number of topics created across all subjects.
    """
    init_db()
    db: Session = next(get_db())
    try:
        created_total = 0
        for entry in NECTA_SYLLABUS:
            try:
                created, topics, sub_topics = _seed_entry(db, entry, set())
                created_total += created
                db.commit()
                print(f"  {entry['name']} ({entry['code']}): {topics} topics, {sub_topics} subtopics in admin catalog ({created} new topics).")
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