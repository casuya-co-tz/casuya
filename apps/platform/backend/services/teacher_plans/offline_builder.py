"""The deterministic offline lesson-plan builder.

Kept as its own module because ``_build_lesson_plan_offline`` alone is close
to the 400-line budget for one file. Lesson helpers (reference grounding,
knowledge-base lookup, per-period scheme-row bridge) stay in
``offline_lesson.py``; the test seam ``offline.fetch_reference_grounding`` /
``offline.get_subject_with_form`` is looked up through the ``offline`` package
facade at call time so monkeypatches keep working.
"""

from __future__ import annotations

from backend.services.reference_library_service import lesson_plan_grounding

from . import offline as _offline
from .builder_scaffold import _build_stage_scaffold
from .competences import (
    _authoritative_competences,
    _build_lesson_plan_topic_codes,
    _ground_progression_assessment,
    _stage_assessment_criteria,
)
from .offline_builder_text import (
    evaluation_learners_text,
    evaluation_teacher_text,
    lesson_objective_text,
    remarks_text,
)
from .utils import _strip_item_marker


def _build_lesson_plan_offline(
    *, subject_slug, subject_label, form_level, topic, subtopic,
    school_name, teacher_name, number_of_students, students_boys=None, students_girls=None,
    duration_minutes, period, lang,
    learning_activity=None, lesson_number=None, lesson_total=None,
) -> dict:
    subtopic_display = subtopic or ("General Overview" if lang == "en" else "Mawazo ya Jumla")
    scaffold = _build_stage_scaffold(
        lang=lang,
        topic=topic,
        subtopic_display=subtopic_display,
        subject_label=subject_label,
        form_level=form_level,
        number_of_students=number_of_students,
        students_boys=students_boys,
        students_girls=students_girls,
        duration_minutes=duration_minutes,
    )
    times = scaffold["times"]
    today = scaffold["today"]
    time_to = scaffold["time_to"]
    class_name = scaffold["class_name"]
    boys = scaffold["boys"]
    girls = scaffold["girls"]
    total = scaffold["total"]
    stage_names = scaffold["stage_names"]
    teacher_acts = scaffold["teacher_acts"]
    learner_acts = scaffold["learner_acts"]
    assessment = scaffold["assessment"]
    resources = scaffold["resources"]
    references = scaffold["references"]
    environment = scaffold["environment"]
    main_comp = scaffold["main_comp"]
    spec_comp = scaffold["spec_comp"]
    main_act = scaffold["main_act"]
    spec_act = scaffold["spec_act"]
    fields = scaffold["fields"]

    # Prefer content sourced from the Scheme-of-Work rows (derived from the
    # verbatim TIE syllabus): competence, activities, resources and references
    # all come from the same teaching row the teacher planned. Falls back to
    # the knowledge-base lookup (then the generic scaffolding) when the
    # subject/form has no real scheme data or no row matches the topic/subtopic.
    scheme_row = _offline._scheme_row_for_lesson(subject_slug, form_level, topic, subtopic, lang)
    if scheme_row:
        main_comp = scheme_row.get("main_competence") or main_comp
        spec_comp = scheme_row.get("specific_competence") or spec_comp
        main_act = scheme_row.get("learning_activities") or main_act
        sas = scheme_row.get("specific_activities") or []
        if sas:
            spec_act = _strip_item_marker(sas[0]) or main_act
        elif scheme_row.get("learning_activities"):
            spec_act = scheme_row["learning_activities"]
        if scheme_row.get("teaching_resources"):
            resources = list(scheme_row["teaching_resources"])
        if scheme_row.get("reference"):
            references = [scheme_row["reference"]]
    else:
        kb_plan = _offline._lookup_lesson_plan_content(
            subject_slug, form_level, topic, subtopic, lang, duration_minutes, subtopic_display
        )
        if kb_plan:
            main_comp = kb_plan["main_comp"]
            spec_comp = kb_plan["spec_comp"]
            main_act = kb_plan["main_act"]
            spec_act = kb_plan["spec_act"]
            if kb_plan["resources"]:
                resources = kb_plan["resources"]
            if kb_plan["references"]:
                references = kb_plan["references"]
            if kb_plan["realization"]:
                teacher_acts[3] = kb_plan["realization"]["teacher_activity"]
                learner_acts[3] = kb_plan["realization"]["learner_activity"]
                assessment[3] = kb_plan["realization"]["assessment"]

    # Ground any still-generic fields with the imported reference library (the
    # official lessons/schemes from the public platform) so offline output
    # carries authentic competence, activity, resource and reference text.
    # Verbatim TIE statements below still take precedence for competences.
    _ref_gl = _offline._reference_lesson_grounding(subject_slug, form_level, topic, subtopic or "")
    _ground = _offline.fetch_reference_grounding(subject_slug, form_level, topic or subtopic, "lesson_plan")
    if _ground and not scheme_row:
        _gl = lesson_plan_grounding(_ground.get("content") or {}, match_hint=subtopic or topic or "")
        if _gl["main_competence"]:
            main_act = main_act or _gl["main_competence"]
        if _gl["specific_competence"]:
            spec_act = spec_act or _gl["specific_competence"]
        if _gl["specific_activity"]:
            spec_act = spec_act or _gl["specific_activity"]
        _generic_resources = {
            ("Kitabu cha somo la " + subject_label + " (TIE)", "Ramani / michoro"),
            ("Vitu halisi", "Chati", "Michezo ya Hisabati"),
            ("Real life objects", "Charts", "Math games and apps"),
            ("Flashcards with word problems on " + topic,
             "Realia (coins/market items)",
             "Chart illustrating steps of " + subtopic_display,
             "Mathematics exercise books"),
        }
        if _gl["resources"] and (tuple(resources) in _generic_resources or not resources):
            resources = _gl["resources"][:4]
        for _ref in _gl["references"][:2]:
            if _ref not in references:
                references.append(_ref)

    # Prefer the verbatim TIE CBC (2023) Main/Specific Competence statements
    # for this teaching topic, independent of the knowledge-base lookup. A
    # bundled, educator-verified reference lesson (e.g. the Geography Form One
    # lessons) carries authentic competences for its own chapter and outranks
    # the keyword-match fallback, because bundled lessons are verified TIE
    # content tailored to exactly that subtopic.
    _verified_comp = _ref_gl if (_ref_gl and _ref_gl.get("__bundled")) else None
    tie_main, tie_spec = _authoritative_competences(
        subject_slug, form_level, topic, lang, ref_gl=_verified_comp)
    if tie_main and tie_spec:
        main_comp = tie_main
        spec_comp = tie_spec

    # When generating one lesson per period (period-weighted lesson plans), focus
    # this individual lesson on a single specific learning activity.
    # The lesson's specific activity. In period-weighted lessons this is the
    # single focused learning activity; otherwise it is the subtopic's specific-
    # activity text from the syllabus (or the generic short phrase).
    if learning_activity:
        focus = learning_activity.strip()
        specific_activity = focus
        if lang == "sw":
            teacher_acts[1] = (f"Anawaongoza wanafunzi kutimiza shughuli: {focus} "
                               f"kwa muktadha wa {subtopic_display}.")
            learner_acts[1] = f"Wanafunzi wanafanya shughuli: {focus}."
        else:
            teacher_acts[1] = (f"Guides students to accomplish the learning activity: {focus} "
                               f"within the context of {subtopic_display}.")
            learner_acts[1] = f"Students carry out the learning activity: {focus}."
    else:
        specific_activity = (spec_act or "").strip()
    # The competence-architecture "specific learning activity" must be this
    # lesson's single focus activity (a concise TIE outcome phrase).
    spec_act = specific_activity

    # Prefix competences with the real TIE topic/subtopic codes (TIE format
    # "{code} {title}"), silently skipped when the syllabus is unavailable.
    # Not applied when the verbatim scheme row is used: its Main/Specific
    # Competence statements already carry the correct TIE codes, so re-prefixing
    # here would double the code (e.g. "7.1 2.2 Demonstrate ...").
    if not scheme_row:
        try:
            _subj = _offline.get_subject_with_form(subject_slug, form_level)
        except Exception:
            _subj = None
        t_code, s_code, _sp = _build_lesson_plan_topic_codes(_subj, topic, subtopic, lang)
        if t_code and not str(main_comp).startswith(str(t_code)):
            main_comp = f"{t_code} {main_comp}"
        if s_code and not str(spec_comp).startswith(str(s_code)):
            spec_comp = f"{s_code} {spec_comp}"

    # Each stage's Assessment Criteria assess THAT stage's Teacher Activity and
    # Learner Activity (reference-library criteria still preferred over this).
    assessment = [
        _stage_assessment_criteria(i, learner_acts[i], lang)
        for i in range(4)
    ]

    progression = []
    core_contents = [
        "Prior knowledge foundation" if lang == "en" else "Maarifa ya awali",
        "Core concepts and definitions" if lang == "en" else "Dhana na vipengele vya msingi",
        "Practical application and synthesis" if lang == "en" else "Matumizi ya vitendo na ujumuishaji",
        "Presentation and consolidation" if lang == "en" else "Uonyeshaji na ukomavu",
    ]
    for i, label in enumerate(stage_names):
        progression.append({
            "stage": label,
            "time": f"{times[i]} min" if lang != "sw" else f"dakika {times[i]}",
            "core_content": core_contents[i],
            "teacher_activity": teacher_acts[i],
            "learner_activity": learner_acts[i],
            "assessment_criteria": assessment[i],
        })

    # When the matched reference lesson carries a complete verified four-stage
    # progression, its teacher/learner/assessment cells ARE the lesson content:
    # offline output mirrors the educator-verified plan instead of the generic
    # scaffold, while keeping this lesson's own period times and core_content.
    if _ref_gl and _ref_gl.get("matched") and len(_ref_gl.get("progression") or []) == 4:
        for stage, ref_stage in zip(progression, _ref_gl["progression"]):
            if ref_stage.get("teacher_activity"):
                stage["teacher_activity"] = ref_stage["teacher_activity"]
            if ref_stage.get("learner_activity"):
                stage["learner_activity"] = ref_stage["learner_activity"]
            if ref_stage.get("assessment_criteria"):
                stage["assessment_criteria"] = ref_stage["assessment_criteria"]

    # Prefer the reference library's authentic per-stage Assessment Criteria
    # over the stage-derived criteria when a matching topic reference exists.
    progression = _ground_progression_assessment(
        progression, subject_slug, form_level, topic, lang
    )

    header_subtopic = subtopic_display
    if learning_activity:
        header_subtopic = f"{subtopic_display} — {learning_activity}".strip(" —")
    header_period = period
    if lesson_number is not None:
        if lesson_total:
            header_period = f"{period} ({lesson_number}/{lesson_total})"
        else:
            header_period = f"{period} · {lesson_number}"

    return {
        "header": {
            "school_name": school_name, "teacher_name": teacher_name,
            "class_name": class_name, "subject": subject_label,
            "topic": topic, "subtopic": header_subtopic,
            "date": today, "time_from": "08:00", "time_to": time_to,
            "period": header_period, "number_of_students": total,
            "students_registered": {"boys": boys, "girls": girls, "total": total},
            "students_present": {"boys": "", "girls": "", "total": ""},
            "students_absent": {"boys": "", "girls": "", "total": ""},
        },
        "competence_architecture": {
            "main_competence": main_comp,
            "specific_competence": spec_comp,
            "main_learning_activity": main_act,
            "specific_learning_activity": spec_act,
            "lesson_objective": lesson_objective_text(
                duration_minutes=duration_minutes,
                specific_activity=specific_activity,
                lang=lang,
            ),
        },
        "resources_strategies": {
            "teaching_learning_resources": resources,
            "references": references,
            "learning_environment": environment,
        },
        "progression_matrix": progression,
        "fields": fields,
        "evaluation_learners": evaluation_learners_text(
            duration_minutes=duration_minutes,
            specific_activity=specific_activity,
            total=total,
            boys=boys,
            girls=girls,
            lang=lang,
        ),
        "evaluation_teacher": evaluation_teacher_text(
            subject_label=subject_label,
            specific_activity=specific_activity,
            duration_minutes=duration_minutes,
            lang=lang,
        ),
        "remarks": remarks_text(
            total=total,
            specific_activity=specific_activity,
            lang=lang,
        ),
    }