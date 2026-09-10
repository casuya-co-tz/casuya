"""Reference library — lesson-plan grounding enrichment helpers."""

from __future__ import annotations


def _plan_field(content: dict, *keys: str) -> str:
    """First non-empty value across any lesson plan_detail for the given keys."""
    for detail in content.get("plan_details") or []:
        for key in keys:
            value = detail.get(key)
            if value:
                return value
    return ""


def _split_delimited(value) -> list:
    """Split a comma-delimited string into clean, de-duplicated items."""
    items = []
    for part in (value or "").split(","):
        item = " ".join(str(part).split()).strip()
        if item and item not in items:
            items.append(item)
    return items


def _collapsed(text) -> str:
    return " ".join(str(text).split()).strip()


def _as_citations(value) -> list:
    """Normalize a plan-detail references value into one or more citation
    strings. Handles prose strings, dicts, and char/label-split lists."""
    if not value:
        return []
    if isinstance(value, list | tuple):
        items = [_collapsed(ref.get("name") or ref.get("title") if isinstance(ref, dict) else ref)
                 for ref in value]
        items = [i for i in items if i]
        if items and all(len(i) == 1 for i in items):
            return [_collapsed("".join(items))]
        return items
    return [_collapsed(value)]


def _lesson_progression(content: dict) -> list[dict]:
    """Normalize the first plan detail's teaching structure into the lesson
    plan schema used by generators: ``[{stage, time, teacher_activity,
    learner_activity, assessment_criteria}]``. Empty when the payload has no
    usable per-stage text. Only the first detail is used so chapter bundles
    (one detail per lesson) expose exactly that lesson's stages."""
    progression: list[dict] = []
    details = content.get("plan_details") or []
    if not details:
        return progression
    first = details[0] if isinstance(details[0], dict) else {}
    for stage in first.get("teaching_structure") or []:
        if not isinstance(stage, dict):
            continue
        teacher = _collapsed(stage.get("teaching_activities"))
        learner = _collapsed(stage.get("learning_activities"))
        if not (teacher or learner):
            continue
        progression.append({
            "stage": _collapsed(stage.get("stage")),
            "time": _collapsed(stage.get("time")),
            "teacher_activity": teacher,
            "learner_activity": learner,
            "assessment_criteria": _collapsed(stage.get("assessment_criteria")),
        })
    return progression


def lesson_plan_grounding(content: dict, match_hint: str = "") -> dict:
    """Extract teacher-facing enrichments (comp/activity/resources/references
    and the per-stage progression) from a reference lesson-plan payload.

    Detail values are mostly strings (comma/line-delimited); references are
    kept whole as citations while resources are split into individual items.
    ``match_hint`` (normally the requested topic/subtopic) marks the result
    ``matched=True`` when it appears in the lesson's own teaching text, letting
    callers trust the extracted content as the authoritative lesson for that
    topic rather than a chapter-first fallback."""
    references = []
    for detail in content.get("plan_details") or []:
        for ref in _as_citations(detail.get("references")) + _as_citations(detail.get("resource_references")):
            if ref and ref not in references:
                references.append(ref)
    resources_seen = []
    resources = []
    for detail in content.get("plan_details") or []:
        res_value = detail.get("teaching_learning_resources") or detail.get("resources") or ""
        for item in _split_delimited(res_value):
            if item not in resources_seen:
                resources_seen.append(item)
                resources.append(item)
    fields = {
        "main_competence": _plan_field(content, "main_competence"),
        "specific_competence": _plan_field(content, "specific_competence"),
        "main_activity": _plan_field(content, "main_activity"),
        "specific_activity": _plan_field(content, "specific_activity"),
        "resources": resources,
        "references": references,
        "progression": _lesson_progression(content),
    }
    hint = (match_hint or "").strip().lower()
    if hint:
        haystack = " ".join(
            str(fields[k] or "").lower()
            for k in ("main_competence", "specific_competence", "main_activity", "specific_activity")
        ) + " " + " ".join(str(x).lower() for x in resources) + " " + \
            " ".join(str(p.get("teacher_activity") or "") + " " + str(p.get("learner_activity") or "")
                     for p in fields["progression"])
        fields["matched"] = hint in haystack
    else:
        fields["matched"] = False
    return fields