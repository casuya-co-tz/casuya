"""Syllabus service — provides NECTA/TIE curriculum data for AI and platform use.

The AI agent queries this service to:
1. Get the exact topic structure for a student's form level and subject
2. Find learning outcomes for content generation
3. Track syllabus coverage for teachers
4. Recommend the next topic to study based on curriculum sequence
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session, joinedload

from backend.config.database import get_db
from backend.models.syllabus import (
    LearningOutcome,
    SyllabusSubject,
    SyllabusSubtopic,
    SyllabusTopic,
)

logger = logging.getLogger(__name__)


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
        subjects = query.all()
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


# ── Subtopic and outcome queries ───────────────────────────────────────────


def get_subtopic_with_outcomes(subtopic_id: str) -> dict | None:
    """Get a specific subtopic with all its learning outcomes."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        subtopic = (
            db.query(SyllabusSubtopic)
            .options(joinedload(SyllabusSubtopic.outcomes))
            .filter(SyllabusSubtopic.id == subtopic_id)
            .first()
        )
        if not subtopic:
            return None
        return _subtopic_to_dict(subtopic)
    finally:
        _gen.close()


def get_outcomes_for_subtopic(topic_id: str, subtopic_code: str | None = None) -> list[dict]:
    """Get all learning outcomes for a subtopic, optionally filtered by code."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = (
            db.query(SyllabusSubtopic)
            .options(joinedload(SyllabusSubtopic.outcomes))
            .filter(SyllabusSubtopic.topic_id == topic_id)
        )

        if subtopic_code:
            query = query.filter(SyllabusSubtopic.code == subtopic_code)

        subtopics = query.all()
        results = []
        for st in subtopics:
            for o in sorted(st.outcomes, key=lambda x: x.order_index):
                results.append(
                    {
                        "subtopic": st.title,
                        "subtopic_code": st.code,
                        "outcome": o.description,
                        "cognitive_level": o.cognitive_level,
                    }
                )
        return results
    finally:
        _gen.close()


# ── AI agent helpers ───────────────────────────────────────────────────────


def get_curriculum_context(subject_slug: str, form_level: int) -> str:
    """Build a curriculum context string for AI prompt injection.

    This is used by the AI tutoring engine to ensure responses are
    aligned with the exact TIE syllabus content.
    """
    subject_data = get_subject_with_form(subject_slug, form_level)
    if not subject_data:
        return ""

    lines = [
        f"CURRICULUM: TIE {subject_data['name']} (Form {form_level})",
        f"NECTA Code: {subject_data.get('necta_code', 'N/A')}",
        "",
    ]

    for topic in subject_data.get("topics", []):
        lines.append(f"Topic {topic['code']}: {topic['title']} ({topic.get('necta_weight', 'medium')} weight)")
        for sub in topic.get("subtopics", []):
            lines.append(f"  {sub['code']}: {sub['title']}")
            for outcome in sub.get("outcomes", []):
                lines.append(f"    [{outcome['cognitive_level']}] {outcome['description']}")

    return "\n".join(lines)


def search_outcomes(query: str, subject_slug: str | None = None, form_level: int | None = None) -> list[dict]:
    """Search for learning outcomes matching a text query.

    The AI agent uses this to find relevant syllabus objectives
    when a student asks a question.
    """
    _gen = get_db()
    db: Session = next(_gen)
    try:
        q = (
            db.query(LearningOutcome)
            .join(SyllabusSubtopic)
            .join(SyllabusTopic)
            .join(SyllabusSubject)
            .filter(LearningOutcome.description.ilike(f"%{query}%"))
        )

        if subject_slug:
            q = q.filter(SyllabusSubject.slug == subject_slug)
        if form_level is not None:
            q = q.filter(SyllabusTopic.form_level == form_level)

        outcomes = q.limit(10).all()
        return [
            {
                "outcome": o.description,
                "cognitive_level": o.cognitive_level,
                "subtopic": o.subtopic.title,
                "topic": o.subtopic.topic.title,
                "subject": o.subtopic.topic.subject.name,
                "form_level": o.subtopic.topic.form_level,
            }
            for o in outcomes
        ]
    finally:
        _gen.close()


# ── Helpers ────────────────────────────────────────────────────────────────


def _subject_to_dict(subject: SyllabusSubject) -> dict:
    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "slug": subject.slug,
        "necta_code": subject.necta_code,
        "description": subject.description,
        "form_start": subject.form_start,
        "form_end": subject.form_end,
        "is_core": subject.is_core,
        "topics": [_topic_to_dict(t) for t in sorted(subject.topics, key=lambda x: x.order_index)],
    }


def _topic_to_dict(topic: SyllabusTopic) -> dict:
    return {
        "id": topic.id,
        "title": topic.title,
        "code": topic.code,
        "description": topic.description,
        "form_level": topic.form_level,
        "order_index": topic.order_index,
        "estimated_periods": topic.estimated_periods,
        "necta_weight": topic.necta_weight,
        "subtopics": [_subtopic_to_dict(s) for s in sorted(topic.subtopics, key=lambda x: x.order_index)],
    }


def _subtopic_to_dict(subtopic: SyllabusSubtopic) -> dict:
    return {
        "id": subtopic.id,
        "title": subtopic.title,
        "code": subtopic.code,
        "description": subtopic.description,
        "order_index": subtopic.order_index,
        "estimated_periods": subtopic.estimated_periods,
        "outcomes": [
            {
                "id": o.id,
                "description": o.description,
                "cognitive_level": o.cognitive_level,
                "order_index": o.order_index,
            }
            for o in sorted(subtopic.outcomes, key=lambda x: x.order_index)
        ],
    }
