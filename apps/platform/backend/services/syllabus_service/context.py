"""Curriculum context builder for AI prompt injection."""

from __future__ import annotations

from .subjects import get_subject_with_form


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