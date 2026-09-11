"""TIE competence resolution and assessment quality helpers."""

from __future__ import annotations

import re

from backend.data.tie_competences import lookup_competence
from backend.data.tie_syllabus import find_by_keyword as ts_find_by_keyword
from backend.data.tie_syllabus import get_specific_competences as ts_get_specific_competences
from backend.services.reference_library_service import fetch_reference_grounding

from .constants import _GENERIC_ASSESSMENT_PHRASES
from .utils import _activity_text, _as_text


def _tie_syllabus_competence(subject_slug: str, form_level: int, topic_title: str):
    """Fall back to the full TIE CBC syllabus dataset for the subject.

    Returns verbatim (main_competence, specific_competence) statements from the
    specific-competence record that best matches the teaching topic, or the
    form's first record when nothing matches. Returns (None, None) when the
    subject/form has no TIE syllabus data.
    """
    recs = ts_get_specific_competences(subject_slug, form_level)
    if not recs:
        return None, None
    best = None
    try:
        best = ts_find_by_keyword(subject_slug, form_level, topic_title)
    except Exception:
        best = None
    rec = best or recs[0]
    return (
        f"{rec.get('main_code', '')} {rec.get('main_competence', '')}".strip(),
        f"{rec.get('specific_code', '')} {rec.get('specific_competence', '')}".strip(),
    )


def _tie_competences(subject_slug: str, form_level: int, topic_title: str, lang: str):
    """Return (main_competence, specific_competence) verbatim TIE statements.

    Looks up the official TIE CBC (2023) competence for the given subject /
    form / topic and formats it as "<code> <statement>". Uses the curated
    topic-level mapping first, then falls back to the full TIE syllabus dataset.
    Returns (None, None) when the subject or topic has no TIE data so callers
    can gracefully fall back to their existing behaviour.
    """
    rec = lookup_competence(subject_slug, form_level, topic_title)
    if not rec:
        return _tie_syllabus_competence(subject_slug, form_level, topic_title)
    return (
        f"{rec['main_code']} {rec['main'][lang]}".strip(),
        f"{rec['specific_code']} {rec['specific'][lang]}".strip(),
    )


def _authoritative_competences(subject_slug, form_level, topic_title, lang, ref_gl=None):
    """Best Main/Specific Competence pair for a lesson plan.

    Precedence: (1) the curated topic-level TIE competence mapping, (2) the
    matched verified reference lesson's own competences (educator-verified TIE
    content, e.g. the bundled Physics Form One lessons), (3) the best-effort
    keyword match over the full TIE syllabus dataset. The reference lesson wins
    over the keyword fallback because the bundled lessons carry authentic,
    verified competence statements for their chapters, whereas keyword matching
    can surface a neighbouring topic's row.
    """
    rec = lookup_competence(subject_slug, form_level, topic_title)
    if rec:
        return (
            f"{rec['main_code']} {rec['main'][lang]}".strip(),
            f"{rec['specific_code']} {rec['specific'][lang]}".strip(),
        )
    if ref_gl and ref_gl.get("main_competence") and ref_gl.get("specific_competence"):
        return ref_gl["main_competence"], ref_gl["specific_competence"]
    return _tie_syllabus_competence(subject_slug, form_level, topic_title)


def _build_lesson_plan_topic_codes(subject_data, topic, subtopic, lang):
    """Extract the real topic/subtopic codes and titles for a lesson. Falls back
    to empty codes when the subject or topic is unavailable."""
    if not subject_data or not subject_data.get("topics"):
        return "", "", ""
    t = (topic or "").strip().lower()
    st = (subtopic or "").strip().lower()
    for tp in subject_data["topics"]:
        t_title = (tp.get("title") or "").strip().lower()
        t_code = (tp.get("code") or "").strip().lower()
        if t and (t in t_title or t_title in t or t == t_code):
            for sp in tp.get("subtopics", []):
                s_title = (sp.get("title") or "").strip().lower()
                s_code = (sp.get("code") or "").strip().lower()
                if st and (st in s_title or s_title in st or st == s_code):
                    return tp.get("code") or "", sp.get("code") or "", sp.get("title") or subtopic
    return "", "", ""


def _stage_assessment_criteria(index, learner_activity, lang):
    """Build a natural, stage-specific Assessment Criterion for a progression
    stage from the learners' activity in that stage.

    The frames read like a real teacher's checklist ("Learners <do the stage
    task>; correct completion demonstrates understanding") rather than a quoting
    template, matching the reference-library quality teachers expect.
    """
    l = " ".join(_activity_text(learner_activity).split()).rstrip().rstrip(".")
    if l[:1].isupper():
        l = l[0].lower() + l[1:]
    if lang == "sw":
        frames = (
            f"Wanafunzi {l}; majibu sahihi yanaonyesha utayari wa somo.",
            f"Wanafunzi {l}; kukamilika kwa kazi kwa usahihi kunaonyesha uelewa wa dhana.",
            f"Wanafunzi {l}; kukamilika kwa kazi kwa usahihi kunaonyesha matumizi ya ujuzi.",
            f"Wanafunzi {l}; uwasilishaji wazi na majibu sahihi vinathibitisha ukomavu wa dhana.",
        )
    else:
        frames = (
            f"Learners {l}; accurate responses show readiness for the lesson.",
            f"Learners {l}; correct completion of the task demonstrates understanding.",
            f"Learners {l}; successful task completion demonstrates application.",
            f"Learners {l}; clear presentation and accurate answers confirm consolidation.",
        )
    return frames[index]


def _reference_stage_assessments(subject_slug, form_level, topic):
    """Best-effort per-stage Assessment Criteria from the imported reference
    library for the teaching topic.

    Returns (by_name, by_index): by_name maps a normalized stage name to its
    assessment text; by_index lists assessments in document order. Empty when
    the subject/topic has no reference lesson plan.
    """
    by_name = {}
    by_index = []
    try:
        ground = fetch_reference_grounding(subject_slug, form_level, topic or None, "lesson_plan")
    except Exception:
        return by_name, by_index
    content = (ground or {}).get("content") or {}
    for detail in content.get("plan_details") or []:
        for stage in detail.get("teaching_structure") or []:
            name = " ".join((stage.get("stage") or "").lower().split())
            value = _as_text(stage.get("assessment_criteria"))
            if value:
                if name:
                    by_name.setdefault(name, value)
                by_index.append(value)
    return by_name, by_index


def _assessment_quality_reason(text, stage_name, lang):
    """Return why an existing Assessment Criterion cell is weak (None = keep
    it). This lets good, naturally-written AI criteria survive - they are only
    replaced when they are empty, generic filler, too short, or name no actor."""
    text = _as_text(text).strip()
    if not text:
        return "missing"
    lowered = text.lower()
    if any(p in lowered for p in _GENERIC_ASSESSMENT_PHRASES):
        return "generic filler"
    if lowered.strip(" .:;,-\"'") in (stage_name.lower().strip(" ."), "assessment_criteria"):
        return "labels only"
    if len(re.findall(r"\S+", text)) < 5:
        return "too short"
    if lang == "sw":
        mentions_actor = "wanafunzi" in lowered or "mwanafunzi" in lowered
    else:
        mentions_actor = (any(w in lowered for w in ("students", "learners", "learner", "pupils"))
                          or "teacher" in lowered)
    if not mentions_actor:
        return "names no actor"
    return None


def _ground_progression_assessment(progression, subject_slug, form_level, topic, lang):
    """Make every stage's Assessment Criteria meaningful and stage-specific.

    Reference text wins when a matching reference-library stage exists. Every
    other stage keeps its existing criterion when it is already well-written
    (a natural, actor-named sentence); weak cells are rewritten using that
    stage's own Learner Activity, mirroring the reference-library style.
    """
    by_name, by_index = _reference_stage_assessments(subject_slug, form_level, topic)
    stages = progression or []
    has_reference = bool(by_name or by_index)
    for i, stage in enumerate(stages):
        name = " ".join((stage.get("stage") or "").lower().split())
        replacement = by_name.get(name) if name else None
        if not replacement and has_reference and len(by_index) == len(stages):
            replacement = by_index[i]
        if replacement:
            stage["assessment_criteria"] = replacement
            continue
        existing = _as_text(stage.get("assessment_criteria"))
        if existing and not _assessment_quality_reason(existing, name, lang):
            continue
        stage["assessment_criteria"] = _stage_assessment_criteria(
            i,
            stage.get("learner_activity"),
            lang,
        )
    return progression
