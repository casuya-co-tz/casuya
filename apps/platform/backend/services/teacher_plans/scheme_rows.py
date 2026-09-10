"""Teaching-row builders for the offline scheme-of-work generator.

``_build_scheme_offline`` (in ``offline_scheme.py``) assembles months, the
midterm weeks and the final calendar; the row data itself comes from two
sources kept here: the verbatim TIE CBC syllabus dataset and the knowledge
base. Patched seams (``offline.fetch_reference_grounding`` /
``get_subject_with_form``) are resolved through the ``offline`` facade at call
time so monkeypatches keep working.
"""

from __future__ import annotations

import re

from backend.data.tie_syllabus import (
    find_by_keyword as ts_find_by_keyword,
    get_specific_competences as ts_get_specific_competences,
)
from backend.services.reference_library_service import scheme_of_work_grounding

from . import offline as _offline
from .competences import _tie_competences
from .utils import (
    _derive_specific_activities,
    _distribute_periods,
    _e_list_item,
    _sample_book_reference,
    _split_periods_total,
    _subject_book,
)


def _rows_from_syllabus(
    *,
    subject_slug: str,
    form_level: int,
    lang: str,
    topics: list,
    methods: list,
    methods_en: list,
    subject_label: str,
) -> list:
    """Expand the verbatim TIE CBC (2023) syllabus dataset into scheme rows.

    Each Specific Competence is expanded into one scheme row per learning
    activity, with the activity's (i)/(ii)/(iii) sub-parts as the row's
    "Specific activities" and the competence's total periods split across
    those rows. Returns an empty list when the syllabus has no data.
    """
    try:
        specs = ts_get_specific_competences(subject_slug, form_level)
    except Exception:
        specs = []

    if not specs:
        return []

    # If specific topics were requested, keep only the competences that best
    # match them; otherwise include the full form syllabus.
    if topics:
        kept = []
        for t in topics or []:
            rec = ts_find_by_keyword(subject_slug, form_level, t)
            if rec and rec not in kept:
                kept.append(rec)
        specs = kept or specs

    rows = []
    for spec in specs:
        acts = spec.get("learning_activities") or []
        activities = [a for a in acts if (a or "").strip()]
        if not activities:
            activities = [spec.get("specific_competence") or "Learning activity"]
        periods_split = _split_periods_total(
            int(spec.get("number_of_periods") or 0), len(activities)
        )
        main_comp = f"{spec.get('main_code', '')} {spec.get('main_competence', '')}".strip()
        spec_comp = f"{spec.get('specific_code', '')} {spec.get('specific_competence', '')}".strip()
        for idx, act in enumerate(activities):
            act_text = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", act).strip()
            specific_activities = _derive_specific_activities(act_text)
            methods_list = spec.get("teaching_methods") or []
            method = _e_list_item(methods_list, idx) or (
                methods[idx % len(methods)] if methods else methods_en
            )
            resource_list = spec.get("resources") or []
            resource = _e_list_item(resource_list, idx) or (
                ["Vitu halisi", "Chati", "Michezo ya Hisabati"]
                 if lang == "sw"
                 else ["Real life objects", "Charts", "Math games and apps"]
            )
            assessment_tools = (
                "Uchunguzi, maswali na majibu, kazi ya mradi, uwasilishaji darasani, "
                "majaribio, portfolio na kazi ya nyumbani"
                if lang == "sw"
                else "Quizzes, questions and answers, project work, class presentation, "
                     "tests, portfolio and homework"
            )
            # Richer method set for the row: the syllabus-listed method (if any)
            # plus a rotating subset of the broad TIE method pool.
            row_methods = [m for m in ([method] if method else []) if m]
            for _extra in range(2):
                row_methods.append(methods[(idx + _extra + 1) % len(methods)])
            remark = (
                f"Most learners demonstrated {spec_comp}. Offer remedial tasks for "
                f"those needing reinforcement on {act_text}."
                if lang == "en"
                else f"Wanafunzi wengi wameonyesha {spec_comp}. Wape kazi za kurekebishia "
                     f"wale wanaohitaji msaada zaidi kwenye {act_text}."
            )
            rows.append({
                "topic": main_comp or (spec.get("specific_competence") or act_text),
                "subtopic": spec_comp or act_text,
                "main_competence": main_comp,
                "specific_competence": spec_comp,
                "learning_activities": act_text,
                "specific_activities": specific_activities,
                "periods": periods_split[idx] if periods_split else 4,
                "reference": _sample_book_reference(subject_label, form_level, lang),
                "teaching_methods": row_methods,
                "teaching_resources": [resource] if resource else (
                    ["Vitu halisi", "Chati", "Michezo ya Hisabati"]
                    if lang == "sw"
                    else ["Real life objects", "Charts", "Math games and apps"]
                ),
                "assessment_tools": assessment_tools,
                "remarks": remark,
                "teaching_aids": ["Textbook", "Charts"] if lang == "en" else ["Kitabu", "Ramani"],
                "competences": [main_comp],
                "objectives": specific_activities or [act_text],
                "learning_activity_schedule": _distribute_periods(
                    specific_activities or [act_text], periods_split[idx] if periods_split else 4
                ),
                "references": [_sample_book_reference(subject_label, form_level, lang)],
                "assessment": assessment_tools,
            })

    return rows


def _rows_from_knowledge_base(
    *,
    subject_slug: str,
    form_level: int,
    lang: str,
    topics: list,
    methods: list,
    subject_label: str,
    class_name: str,
    existing_count: int = 0,
) -> list:
    """Fallback: pull syllabus structure (topics -> subtopics) from the
    knowledge base into teaching-week rows."""
    rows = []
    try:
        subject_data = _offline.get_subject_with_form(subject_slug, form_level)
    except Exception:
        subject_data = None

    if subject_data and subject_data.get("topics"):
        for topic in subject_data["topics"]:
            rows.append({
                "topic": topic.get("title") or "Topic",
                "topic_code": topic.get("code", ""),
                "periods": topic.get("estimated_periods") or 0,
                "subtopics": topic.get("subtopics", []),
            })
    else:
        # Fallback: use user-supplied topic titles.
        for i, t in enumerate(topics or [], start=1):
            rows.append({
                "topic": t,
                "topic_code": "",
                "periods": 0,
                "subtopics": [],
            })

    # Flatten subtopics into teaching-week rows. Week numbers and months are
    # assigned afterwards so the two midterm weeks (exam + holiday) can be
    # inserted at the term midpoint and the calendar renumbered coherently.
    _sow = _offline.fetch_reference_grounding(subject_slug, form_level, None, "scheme_of_work")
    _sow_box = scheme_of_work_grounding((_sow or {}).get("content") or {}) if _sow else {}
    week_rows = []
    for row in rows:
        topic_title = row["topic"]
        topic_code = row["topic_code"]
        subs = row["subtopics"]
        if not subs:
            # One week per topic when no subtopic breakdown is available.
            subtopic_list = [{
                "title": (f"Part {existing_count + 1}" if lang == "en" else f"Sehemu ya {existing_count + 1}"),
                "code": "", "estimated_periods": 0, "outcomes": [],
            }]
        else:
            subtopic_list = subs
        for sub in subtopic_list:
            sub_title = sub.get("title") or ""
            sub_code = sub.get("code", "")
            outcomes = [o.get("description", "") for o in (sub.get("outcomes") or []) if o.get("description")]
            spec_periods = sub.get("estimated_periods") or (
                (row["periods"] // len(subtopic_list)) if row["periods"] and subtopic_list else 4
            ) or 4
            if lang == "sw":
                learning_activities = outcomes or [
                    f"Eleza dhana za msingi za {sub_title or topic_title}",
                    f"Tumia {sub_title or topic_title} katika miktadha mbalimbali",
                ]
                main_comp = f"{topic_code} {topic_title}" if topic_code else topic_title
                spec_comp = f"{sub_code} {sub_title}".strip() if sub_code else sub_title
            else:
                learning_activities = outcomes or [
                    f"Explain the basic concepts of {sub_title or topic_title}",
                    f"Apply {sub_title or topic_title} in different contexts",
                ]
                main_comp = f"{topic_code} {topic_title}" if topic_code else topic_title
                spec_comp = f"{sub_code} {sub_title}".strip() if sub_code else sub_title

            # Prefer the verbatim TIE CBC (2023) Main/Specific Competence
            # statements for this teaching topic when the mapping is available.
            tie_main, tie_spec = _tie_competences(subject_slug, form_level, topic_title, lang)
            if tie_main and tie_spec:
                main_comp = tie_main
                spec_comp = tie_spec

            week_row = {
                "topic": topic_title,
                "subtopic": sub_title,
                "main_competence": main_comp,
                "specific_competence": spec_comp,
                "learning_activities": learning_activities,
                "specific_activities": _derive_specific_activities(
                    learning_activities[0]) if learning_activities else [sub_title],
                "periods": spec_periods,
                "reference": (
                    f"TIE (2023) {_subject_book(subject_label, class_name, lang)}"
                ),
                "teaching_methods": _sow_box.get("methods") or methods,
                "teaching_resources": _sow_box.get("resources") or (
                    ["Chati za uhusiano", "Vitu halisi", "Michezo ya Hisabati", "Vituo vya elimu"]
                    if lang == "sw"
                    else ["Charts of relationships", "Real life objects", "Math Games and Apps", "Educational channels"]
                ),
                "assessment_tools": _sow_box.get("assessment") or (
                    "Uchunguzi, maswali na majibu, kazi ya mradi, uwasilishaji darasani, "
                    "majaribio, portfolio na kazi ya nyumbani"
                    if lang == "sw"
                    else "Quizzes, questions and answers, project work, class presentation, "
                         "tests, portfolio and homework"
                ),
                "remarks": (
                    f"Most learners achieved the competence on {spec_comp}. Provide "
                    f"reinforcement tasks and extension work where appropriate."
                    if lang == "en"
                    else f"Wanafunzi wengi wamefikia ujuzi wa {spec_comp}. Toa kazi za "
                         f"kuimarisha na mazoezi ya ziada inapohitajika."
                ),
                "teaching_aids": ["Textbook", "Charts"] if lang == "en" else ["Kitabu", "Ramani"],
                "competences": [main_comp],
                "objectives": learning_activities,
                "learning_activity_schedule": _distribute_periods(learning_activities, spec_periods),
                "references": (["TIE Syllabus"] + (_sow_box.get("references") or []))[:3],
                "assessment": (
                    "Exercises, Q&A, tests and projects" if lang == "en"
                    else "Mazoezi, maswali, majaribio na miradi"
                ),
            }
            week_rows.append(week_row)

    return week_rows