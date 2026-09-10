"""Syllabus queries for subject/topic trees.

The AI agent queries this service to:
1. Get the exact topic structure for a student's form level and subject
2. Find learning outcomes for content generation
3. Track syllabus coverage for teachers
4. Recommend the next topic to study based on curriculum sequence
"""

from __future__ import annotations

from sqlalchemy.orm import Session, joinedload, selectinload

from backend.config.database import get_db
from backend.models.syllabus import (
    LearningOutcome,
    SyllabusSubject,
    SyllabusSubtopic,
    SyllabusTopic,
)

from .serializers import _subject_to_dict, _topic_to_dict


# ── Subject queries ────────────────────────────────────────────────────────


def list_subjects(form_level: int | None = None, core_only: bool = False) -> list[dict]:
    """List all NECTA subjects, optionally filtered by form level and core status."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(SyllabusSubject).filter(SyllabusSubject.is_active == True)  # noqa: E712
        if core_only:
            query = query.filter(SyllabusSubject.is_core == True)  # noqa: E712
        if form_level is not None:
            query = query.filter(
                SyllabusSubject.form_start <= form_level,
                SyllabusSubject.form_end >= form_level,
            )
        subjects = query.options(selectinload(SyllabusSubject.topics)).all()
        return [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "slug": s.slug,
                "necta_code": s.necta_code,
                "form_start": s.form_start,
                "form_end": s.form_end,
                "is_core": s.is_core,
                "description": s.description,
                "topic_count": len(s.topics),
            }
            for s in subjects
        ]
    finally:
        _gen.close()


def get_subject_by_slug(slug: str) -> dict | None:
    """Get a subject with all topics by its slug."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subject = (
            db.query(SyllabusSubject)
            .options(
                joinedload(SyllabusSubject.topics)
                .joinedload(SyllabusTopic.subtopics)
                .joinedload(SyllabusSubtopic.outcomes)
            )
            .filter(SyllabusSubject.slug == slug)
            .first()
        )
        if not subject:
            return None
        return _subject_to_dict(subject)
    finally:
        _gen.close()


def get_subject_with_form(slug: str, form_level: int) -> dict | None:
    """Get a subject's topics for a specific form level, with subtopics and outcomes."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subject = (
            db.query(SyllabusSubject)
            .options(
                joinedload(SyllabusSubject.topics)
                .joinedload(SyllabusTopic.subtopics)
                .joinedload(SyllabusSubtopic.outcomes)
            )
            .filter(SyllabusSubject.slug == slug)
            .first()
        )
        if not subject:
            return None

        # Filter topics to the requested form level
        filtered_topics = [t for t in subject.topics if t.form_level == form_level]

        return {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "slug": subject.slug,
            "necta_code": subject.necta_code,
            "form_level": form_level,
            "is_core": subject.is_core,
            "topics": [_topic_to_dict(t) for t in filtered_topics],
        }
    finally:
        _gen.close()


# ── Topic queries ──────────────────────────────────────────────────────────


def get_topics_for_form(subject_slug: str, form_level: int) -> list[dict]:
    """Get all topics for a subject and form level."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subject = db.query(SyllabusSubject).filter(SyllabusSubject.slug == subject_slug).first()
        if not subject:
            return []

        topics = (
            db.query(SyllabusTopic)
            .options(joinedload(SyllabusTopic.subtopics).joinedload(SyllabusSubtopic.outcomes))
            .filter(SyllabusTopic.subject_id == subject.id, SyllabusTopic.form_level == form_level)
            .order_by(SyllabusTopic.order_index)
            .all()
        )
        return [_topic_to_dict(t) for t in topics]
    finally:
        _gen.close()