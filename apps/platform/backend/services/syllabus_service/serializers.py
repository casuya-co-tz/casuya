"""Shared ORM-to-dict serializers for the syllabus service."""

from __future__ import annotations

from backend.models.syllabus import SyllabusSubject, SyllabusSubtopic, SyllabusTopic


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