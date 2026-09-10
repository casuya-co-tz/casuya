"""Offline scheme-of-work builder and verified-reference row helpers.

Patched seams (``offline.fetch_reference_grounding`` / ``get_subject_with_form``)
are resolved through the ``offline`` facade at call time. The teaching-row
data (verbatim TIE syllabus / knowledge-base fallback) is built in
``scheme_rows.py``; this module keeps the verified-reference pipeline and the
final calendar assembly.
"""

from __future__ import annotations

import re

from backend.services.reference_library_service import scheme_of_work_grounding

from . import offline as _offline
from .offline_quality import _midterm_weeks
from .scheme_rows import _rows_from_knowledge_base, _rows_from_syllabus
from .utils import _distribute_periods, _subject_book


def _reference_scheme_grounding(subject_slug, form_level, term):
    """Best-matching educator-verified (bundled) reference scheme for a term.

    Returns the ``scheme_of_work_grounding`` enrichment (generic methods,
    resources, assessment, references plus the normalized per-week ``rows``)
    only when the reference library has a bundled, verified scheme document for
    the subject/form/term (e.g. the Geography Form One Term I/II schemes).
    External (librarian-imported) scheme documents are NOT trusted for this so
    offline generation never reproduces unverified rows.
    """
    term_digit = re.sub(r"[^0-9]", "", str(term or "")) or ""
    term_label = f"term {term_digit}" if term_digit in ("1", "2") else None
    try:
        ground = _offline.fetch_reference_grounding(subject_slug, form_level, term_label, "scheme_of_work")
    except Exception:
        return None
    if not ground or not str(ground.get("source_id") or "").startswith("bundled:"):
        return None
    gl = scheme_of_work_grounding(ground.get("content") or {})
    if not gl.get("rows"):
        return None
    gl["__bundled"] = True
    return gl


def _scheme_row_requested(topics: list, ref_row: dict) -> bool:
    """True when a verified scheme row's topic/competence/activity matches any
    of the requested topic keywords (case-insensitive substring)."""
    if not topics:
        return True
    haystack = " ".join(
        str(ref_row.get(k) or "") for k in
        ("topic", "main_competence", "specific_competence", "main_activity")
    ).lower()
    return any(t and str(t).lower() in haystack for t in topics)


def _verified_scheme_week_row(gl_row, *, lang, subject_label, form_level) -> dict:
    """Build a scheme week-row (the shape used by the offline scheme generator)
    from one normalized, verified reference scheme row - competences,
    activities, strategies, resources, assessment tools and remarks reproduced
    verbatim from the educator-verified source."""
    main_comp = gl_row.get("main_competence") or ""
    spec_comp = gl_row.get("specific_competence") or ""
    activity = gl_row.get("main_activity") or spec_comp
    specific_activity = gl_row.get("specific_activity") or activity
    topic = gl_row.get("topic") or spec_comp
    reference = gl_row.get("reference") or (
        f"TIE (2026) {_subject_book(subject_label, f'Form {form_level}', lang)}"
    )
    periods = 1
    try:
        periods = int(gl_row.get("periods") or 1)
    except (TypeError, ValueError):
        periods = 1
    periods = max(periods, 1)
    methods = gl_row.get("methods") or (
        ["Uchunguzi", "Majadiliano", "Kazi ya mradi", "Uwasilishaji"]
        if lang == "sw"
        else ["Exploration", "Guided discussion", "Project work", "Presentation"]
    )
    resources = gl_row.get("resources") or (
        ["Vitu halisi", "Chati", "Michezo ya Hisabati"]
        if lang == "sw"
        else ["Real life objects", "Charts", "Math games and apps"]
    )
    assessment = gl_row.get("assessment") or (
        "Uchunguzi, maswali na majibu, kazi ya mradi, uwasilishaji darasani, "
        "majaribio, portfolio na kazi ya nyumbani"
        if lang == "sw"
        else "Quizzes, questions and answers, project work, class presentation, "
             "tests, portfolio and homework"
    )
    remark = gl_row.get("remarks") or (
        f"Most learners achieved the competence on {spec_comp}. Provide "
        f"reinforcement tasks and extension work where appropriate."
        if lang == "en"
        else f"Wanafunzi wengi wamefikia ujuzi wa {spec_comp}. Toa kazi za "
             f"kuimarisha na mazoezi ya ziada inapohitajika."
    )
    return {
        "topic": topic,
        "subtopic": activity,
        "main_competence": main_comp,
        "specific_competence": spec_comp,
        "learning_activities": [activity],
        "specific_activities": [specific_activity],
        "periods": periods,
        "reference": reference,
        "teaching_methods": methods,
        "teaching_resources": resources,
        "assessment_tools": assessment,
        "remarks": remark,
        "teaching_aids": ["Textbook", "Charts"] if lang == "en" else ["Kitabu", "Ramani"],
        "competences": [main_comp or topic],
        "objectives": [specific_activity],
        "learning_activity_schedule": _distribute_periods([specific_activity], periods),
        "references": [reference, "TIE Syllabus"],
        "assessment": assessment,
    }


def _build_scheme_offline(
    *, subject_slug, subject_label, form_level, term, academic_year,
    school_name, teacher_name, topics, lang,
) -> dict:
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"
    weeks = []
    months_en = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"]
    months_sw = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni",
                 "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"]
    methods_en = ["Collaborative learning", "Exploration/visual representation", "Project work",
                  "Jigsaw puzzle", "Problem solving", "Use of technology", "Graphical methods",
                  "Group discussion", "Think-Ink pair-share", "Interactive discussion",
                  "Scenario-based learning"]
    methods_sw = ["Kujifunza kwa ushirikiano", "Uchunguzi/Uwakilishi wa kuona", "Kazi ya mradi",
                  "Maswali ya Jigsaw", "Utatuzi wa matatizo", "Matumizi ya teknolojia",
                  "Mbinu za picha/grafu", "Mjadala wa kikundi", "Jozi za kujadiliana",
                  "Mjadala shirikishi", "Kujifunza kwa muktadha/matukio"]
    months = months_en if lang == "en" else months_sw
    methods = methods_en if lang == "en" else methods_sw

    # Two-term academic year: Term I = Jan-May, Term II = Jul-Nov (4 weeks/month).
    term_months = [0, 1, 2, 3, 4] if "1" in term else [6, 7, 8, 9, 10]

    teaching_rows = []

    # A bundled, educator-verified scheme of work for this subject/form/term is
    # the authoritative model for offline output: its per-week rows reproduce
    # the educator-verified competences, activities, strategies, resources and
    # assessment tools verbatim (e.g. the Geography Form One Term I/II schemes).
    _ref_rows = []
    _ref_scheme = _reference_scheme_grounding(subject_slug, form_level, term)
    if _ref_scheme:
        for _ref_row in _ref_scheme.get("rows") or []:
            if _ref_row.get("non_teaching"):
                continue
            if topics and not _scheme_row_requested(topics, _ref_row):
                continue
            teaching_rows.append(_verified_scheme_week_row(
                _ref_row, lang=lang, subject_label=subject_label,
                form_level=form_level,
            ))
        _ref_rows = teaching_rows

    # Preferred source: the verbatim TIE CBC (2023) syllabus dataset. Each
    # Specific Competence is expanded into one scheme row per learning
    # activity, with the activity's (i)/(ii)/(iii) sub-parts as the row's
    # "Specific activities" and the competence's total periods split across
    # those rows. Skipped when verified reference rows already produced the
    # full term scheme.
    if not _ref_rows:
        teaching_rows.extend(_rows_from_syllabus(
            subject_slug=subject_slug,
            form_level=form_level,
            lang=lang,
            topics=topics,
            methods=methods,
            methods_en=methods_en,
            subject_label=subject_label,
        ))

    # Fallback: pull syllabus structure from the knowledge base (topics -> subtopics).
    if not teaching_rows:
        teaching_rows.extend(_rows_from_knowledge_base(
            subject_slug=subject_slug,
            form_level=form_level,
            lang=lang,
            topics=topics,
            methods=methods,
            subject_label=subject_label,
            class_name=class_name,
            existing_count=len(teaching_rows),
        ))

    # Insert the two required midterm weeks (examination + holiday) at the
    # midpoint of the term's teaching weeks, for every term.
    mid = len(teaching_rows) // 2
    weeks = list(teaching_rows[:mid]) + _midterm_weeks(lang) + list(teaching_rows[mid:])

    # Assign coherent week numbers and months across the full term.
    for i, w in enumerate(weeks):
        wn = i + 1
        month_idx = term_months[(wn - 1) // 4] if wn <= 4 * len(term_months) else term_months[-1]
        w["week_number"] = wn
        w["week"] = f"Week {wn}" if lang == "en" else f"Wiki {wn}"
        w["month"] = months[month_idx]

    return {
        "header": {
            "school_name": school_name, "teacher_name": teacher_name,
            "subject": subject_label, "class_name": class_name,
            "term": term, "academic_year": academic_year,
        },
        "weeks": weeks,
    }