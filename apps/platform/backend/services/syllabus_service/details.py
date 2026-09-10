"""Subtopic and learning-outcome queries, plus free-text outcome search."""

from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from backend.config.database import get_db
from backend.models.syllabus import (
    LearningOutcome,
    SyllabusSubject,
    SyllabusSubtopic,
    SyllabusTopic,
)

from .serializers import _subtopic_to_dict


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
            .options(
                joinedload(LearningOutcome.subtopic)
                .joinedload(SyllabusSubtopic.topic)
                .joinedload(SyllabusTopic.subject)
            )
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