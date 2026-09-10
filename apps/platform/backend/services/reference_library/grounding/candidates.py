"""Reference library — candidate selection for generation-time grounding."""

from __future__ import annotations

import json

from backend.models.reference_doc import ReferenceDoc


def _fetch_grounding_candidates(db, subject_slug, form_level, doc_type) -> list[ReferenceDoc]:
    q = db.query(ReferenceDoc).filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
    if doc_type:
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    docs = list(q.all())
    # The verified bundle owns the slot whenever one exists: prefer it so
    # grounding never mixes online-catalog copies with educator-verified rows
    # even if a stale duplicate is still sitting in the database.
    if doc_type in ("lesson_plan", "scheme_of_work"):
        bundled = [d for d in docs if str(d.source_id or "").startswith("bundled:")]
        if bundled:
            return bundled
    return docs


def _doc_content_text(doc: ReferenceDoc) -> str:
    """Collapse a reference document's searchable teaching text into one blob.

    Includes competences, activities, per-stage teaching/learning/assessment
    text, resources and references so topic matching can look inside content,
    not just the title (e.g. choose the right single-subtopic lesson plan)."""
    try:
        content = json.loads(doc.content)
    except (TypeError, ValueError):
        content = {}
    parts = [doc.title or ""]

    def _s(value):
        if isinstance(value, str):
            return value
        if isinstance(value, list | tuple):
            return " ".join(_s(v) for v in value if v)
        if isinstance(value, dict):
            return " ".join(_s(v) for v in value.values() if v)
        return str(value or "")

    details = content.get("plan_details") or []
    if not details:
        details = content.get("scheme_of_work_details") or []
    for detail in details:
        if not isinstance(detail, dict):
            continue
        if "teaching_structure" in detail or any(k in detail for k in
                ("main_competence", "main_activity", "specific_competence")):
            for key in ("title", "main_competence", "specific_competence",
                        "main_activity", "specific_activity",
                        "teaching_learning_resources", "resources", "references",
                        "topic"):
                parts.append(_s(detail.get(key)))
        else:
            # scheme rows use the API's one..twelve column keys
            for key in ("topic", "one", "two", "three", "four", "eight",
                        "nine", "ten", "eleven", "twelve"):
                parts.append(_s(detail.get(key)))
        for stage in detail.get("teaching_structure") or []:
            if isinstance(stage, dict):
                for key in ("stage", "teaching_activities", "learning_activities",
                            "assessment_criteria", "time"):
                    parts.append(_s(stage.get(key)))
    return " ".join(parts)