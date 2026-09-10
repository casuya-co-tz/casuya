"""Offline lesson-plan helpers: reference grounding, syllabus knowledge-base
lookup, per-period scheme-row bridge, and last-resort progression patching.

``_build_lesson_plan_offline`` itself lives in ``offline_builder.py`` because
that single function alone is close to this file's line budget.
"""

from __future__ import annotations

import logging

from backend.data.tie_syllabus import get_specific_competences as ts_get_specific_competences
from backend.services.reference_library_service import lesson_plan_grounding

from . import offline as _offline
from .competences import _tie_competences
from .offline_builder import _build_lesson_plan_offline
from .offline_quality import _progression_quality_issues
from .offline_scheme import _build_scheme_offline

logger = logging.getLogger(__name__)


def _reference_lesson_grounding(subject_slug, form_level, topic, subtopic):
    """Best-matching verified/official reference lesson for a lesson request.

    Returns the ``lesson_plan_grounding`` enrichment (competences, activities,
    resources, references, per-stage progression) only when the reference
    library actually contains a lesson that matches the requested topic or
    subtopic. A chapter-first fallback document that merely shares the subject
    is NOT trusted, so generation never grounds on the wrong lesson.

    The private ``__bundled`` flag marks educator-verified lessons shipped with
    the platform (``source_id`` starting ``bundled:``); only those may override
    TIE syllabus competence statements in generated plans.
    """
    match_hint = (subtopic or topic or "").strip()
    try:
        ground = _offline.fetch_reference_grounding(subject_slug, form_level, match_hint or None, "lesson_plan")
    except Exception:
        return None
    if not ground:
        return None
    gl = lesson_plan_grounding(ground.get("content") or {}, match_hint=match_hint)
    if not gl.get("matched"):
        return None
    gl["__bundled"] = str(ground.get("source_id") or "").startswith("bundled:")
    return gl


def _lookup_lesson_plan_content(subject_slug, form_level, topic, subtopic, lang,
                                duration_minutes, subtopic_display):
    """Pull real competences/activities for a topic+subtopic from the syllabus KB.

    Returns None when the subject is unknown (e.g. no DB) or the topic/subtopic is
    not found, so callers gracefully fall back to the generic scaffolding.
    """
    try:
        subject = _offline.get_subject_with_form(subject_slug, form_level)
    except Exception:
        return None
    if not subject or not subject.get("topics"):
        return None

    match_topic = None
    t = (topic or "").strip().lower()
    for tp in subject["topics"]:
        title = (tp.get("title") or "").strip().lower()
        code = (tp.get("code") or "").strip().lower()
        if (t and (t in title or title in t or t == code)):
            match_topic = tp
            break
    if not match_topic:
        return None

    match_subtopic = None
    st = (subtopic or "").strip().lower()
    for sp in match_topic.get("subtopics", []):
        title = (sp.get("title") or "").strip().lower()
        code = (sp.get("code") or "").strip().lower()
        if (st and (st in title or title in st or st == code)):
            match_subtopic = sp
            break

    topic_title = match_topic.get("title") or topic
    topic_code = match_topic.get("code") or ""
    main_comp = (topic_title if lang != "sw" else topic_title)
    main_comp = f"{topic_code} {topic_title}".strip() if topic_code else topic_title

    if match_subtopic is None:
        return {
            "main_comp": main_comp,
            "spec_comp": main_comp,
            "main_act": match_topic.get("description") or main_comp,
            "spec_act": match_topic.get("description") or main_comp,
            "resources": None,
            "references": None,
            "realization": None,
        }

    sub_title = match_subtopic.get("title") or subtopic_display
    sub_code = match_subtopic.get("code") or ""
    spec_comp = f"{sub_code} {sub_title}".strip() if sub_code else sub_title

    # Prefer the verbatim TIE CBC (2023) Main/Specific Competence statements
    # for this teaching topic when the curated mapping is available.
    tie_main, tie_spec = _tie_competences(subject_slug, form_level, topic, lang)
    if tie_main and tie_spec:
        main_comp = tie_main
        spec_comp = tie_spec

    outcomes = [
        o.get("description", "").strip()
        for o in match_subtopic.get("outcomes", [])
        if o.get("description", "").strip()
    ]
    if outcomes:
        spec_act = "; ".join(outcomes)
    else:
        spec_act = match_subtopic.get("description") or spec_comp

    learner_act = " | ".join(outcomes) if outcomes else spec_act
    teacher_act = (f"Guides students as they demonstrate the outcomes for {sub_title}: "
                   + spec_act) if lang != "sw" else (
                       f"Anawaongoza wanafunzi kuonyesha matokeo ya {sub_title}: " + spec_act)
    assessment = (f"Students correctly demonstrate all stated outcomes for {sub_title}; "
                  + (spec_act if not outcomes else "; ".join(outcomes))) if lang != "sw" else (
                      f"Wanafunzi wanadhihirisha matokeo yote ya {sub_title} kwa usahihi.")

    resources = [
        f"TIE {topic_title} reference materials",
        f"Chosen resources on {sub_title}",
    ] if lang == "en" else [
        f"Vifaa vya TIE kuhusu {topic_title}",
        f"Vifaa vilivyochaguliwa vya {sub_title}",
    ]
    references = [f"Tanzania Institute of Education (TIE), {topic_title}."]

    return {
        "main_comp": main_comp,
        "spec_comp": spec_comp,
        "main_act": match_topic.get("description") or main_comp,
        "spec_act": spec_act,
        "resources": resources,
        "references": references,
        "realization": {
            "teacher_activity": teacher_act,
            "learner_activity": learner_act,
            "assessment": assessment,
        },
    }


def _patch_weak_progression_from_offline(plan, *, subject_slug, subject_label, form_level,
                                         topic, subtopic, school_name, teacher_name,
                                         number_of_students, students_boys, students_girls,
                                         duration_minutes, period, lang):
    """Last-resort recovery (near-zero, used only after AI repairs are exhausted):
    rebuild the progression matrix from the deterministic offline builder and keep
    the rest of the AI plan. Patches nothing when the offline matrix also fails."""
    try:
        off = _build_lesson_plan_offline(
            subject_slug=subject_slug,
            subject_label=subject_label,
            form_level=form_level,
            topic=topic,
            subtopic=subtopic,
            school_name=school_name,
            teacher_name=teacher_name,
            number_of_students=number_of_students,
            students_boys=students_boys,
            students_girls=students_girls,
            duration_minutes=duration_minutes,
            period=period,
            lang=lang,
        )
        if not _progression_quality_issues(off, lang):
            plan["progression_matrix"] = off["progression_matrix"]
    except Exception:
        logger.warning("Offline progression recovery failed", exc_info=True)
    return plan


def _scheme_row_for_lesson(subject_slug, form_level, topic, subtopic, lang):
    """Return the Scheme-of-Work teaching row a lesson plan should be built from.

    Builds the syllabus-sourced scheme for the subject/form and keeps only its
    teaching rows (periods > 0), narrowed to the requested topic via the TIE
    keyword bridge. Prefers the row whose learning activity or specific
    activities match the requested subtopic, otherwise returns the first row for
    the topic. Returns ``None`` when the subject/form has no scheme data so
    callers can fall back to the knowledge-base / generic path.
    """
    try:
        if not ts_get_specific_competences(subject_slug, form_level):
            return None
    except Exception:
        return None
    try:
        scheme = _build_scheme_offline(
            subject_slug=subject_slug,
            subject_label=subject_slug.replace("-", " ").title(),
            form_level=form_level,
            term="Term 1",
            academic_year="2026",
            school_name="",
            teacher_name="",
            topics=[topic] if topic else [],
            lang=lang,
        )
    except Exception:
        return None
    rows = [w for w in scheme.get("weeks", []) if w.get("periods", 0) > 0]
    if not rows:
        return None

    st = (subtopic or "").strip().lower()
    if st:
        for r in rows:
            hay = [
                str(r.get("learning_activities", "")),
                str(r.get("subtopic", "")),
            ] + [str(x) for x in (r.get("specific_activities") or [])]
            if any(h and (st in h.lower() or h.lower() in st) for h in hay):
                return r
    return rows[0]