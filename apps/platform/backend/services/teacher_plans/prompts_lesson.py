"""AI prompt builder for lesson plans (official TIE CBC format)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from backend.services.syllabus_service import get_subject_with_form

from .competences import (
    _authoritative_competences,
    _build_lesson_plan_topic_codes,
)
from .constants import (
    _TIE_LESSON_PLAN_RULES_EN,
    _TIE_LESSON_PLAN_RULES_SW,
)
from .offline import _reference_lesson_grounding
from .utils import _time_to


def _build_lesson_plan_prompt(
    *, lang, curriculum_ctx, subject_label, subject_slug, form_level, topic, subtopic,
    school_name, teacher_name, number_of_students, students_boys=None, students_girls=None,
    duration_minutes, period,
) -> str:
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    time_to = _time_to(duration_minutes)
    subtopic_display = subtopic or ("General Overview" if lang == "en" else "Mawazo ya Jumla")
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"

    # Real TIE topic/subtopic codes so competences are prefixed authentically.
    try:
        _subj = get_subject_with_form(subject_slug, form_level)
    except Exception:
        _subj = None
    topic_code, subtopic_code, _sp_title = _build_lesson_plan_topic_codes(
        _subj, topic, subtopic or "", lang
    )
    rules = _TIE_LESSON_PLAN_RULES_EN.format(
        topic_code=topic_code or "#", topic_title=topic,
        subtopic_code=subtopic_code or "#", subtopic_title=subtopic_display,
        duration_minutes=duration_minutes,
    )
    rules_sw = _TIE_LESSON_PLAN_RULES_SW.format(
        topic_code=topic_code or "#", topic_title=topic,
        subtopic_code=subtopic_code or "#", subtopic_title=subtopic_display,
        duration_minutes=duration_minutes,
    )

    # Resolve the verbatim TIE Main/Specific Competence statements for this
    # lesson so the model copies them word-for-word instead of substituting
    # the topic/subtopic TITLES into the competence fields. A matched verified
    # reference lesson (e.g. the bundled Physics Form One content) outranks
    # the best-effort keyword fallback for its chapter.
    ref_gl = _reference_lesson_grounding(subject_slug, form_level, topic, subtopic or "")
    tie_main, tie_spec = _authoritative_competences(
        subject_slug, form_level, topic, lang,
        ref_gl=ref_gl if (ref_gl and ref_gl.get("__bundled")) else None)
    main_comp_hint = tie_main or (
        "the REAL Main Competence statement from the CURRICULUM CONTEXT, verbatim "
        "from the TIE syllabus (e.g. \"1.0 Demonstrate mastery of basic concepts "
        "and skills\") - NOT the topic title"
    )
    spec_comp_hint = tie_spec or (
        "the REAL Specific Competence statement from the CURRICULUM CONTEXT, "
        "verbatim from the TIE syllabus (e.g. \"1.1 Use numerical skills in "
        "different contexts\") - NOT the subtopic title"
    )
    real_comp_block = ""
    if tie_main and tie_spec:
        real_comp_block = (
            f"\nREAL COMPETENCES FOR THIS LESSON (copy VERBATIM into "
            f"main_competence and specific_competence):\n"
            f"main_competence = {tie_main}\n"
            f"specific_competence = {tie_spec}\n"
        )

    # A matched verified reference lesson is the authoritative model for the
    # plan: its competences, activities, resources/references and per-stage
    # teacher/learner/assessment content shape the output exactly like the
    # educator-verified curriculum (e.g. Physics Form One Chapter 1-4).
    reference_block = ""
    if ref_gl:
        progression_text = ""
        for s in ref_gl.get("progression") or []:
            progression_text += (
                f"- {s.get('stage') or 'Stage'} ({s.get('time') or ''}):\n"
                f"  Teacher: {s.get('teacher_activity') or ''}\n"
                f"  Learners: {s.get('learner_activity') or ''}\n"
                f"  Assessment: {s.get('assessment_criteria') or ''}\n"
            )
        reference_block = (
            "VERIFIED REFERENCE LESSON FOR THIS TOPIC (official, educator-verified "
            "curriculum content - treat it as the authoritative example. Mirror its "
            "stage-by-stage flow and phrasing; never contradict its facts):\n"
            f"- main_competence (copy verbatim): {ref_gl.get('main_competence') or ''}\n"
            f"- specific_competence (copy verbatim): {ref_gl.get('specific_competence') or ''}\n"
            f"- main_activity: {ref_gl.get('main_activity') or ''}\n"
            f"- specific_activity: {ref_gl.get('specific_activity') or ''}\n"
            f"- resources: {', '.join(ref_gl.get('resources') or [])}\n"
            f"- references: {'; '.join(ref_gl.get('references') or [])}\n"
            "EXPECTED STAGE-BY-STAGE PROGRESSION (model your progression_matrix on "
            "it, keeping the 5/15/12/8 minute TIE pacing):\n"
            f"{progression_text}"
        )

    students_total = number_of_students
    if students_boys is not None or students_girls is not None:
        boys = students_boys if students_boys is not None else students_total - (students_girls or 0)
        girls = students_girls if students_girls is not None else students_total - boys
        students_total = boys + girls
    else:
        half = students_total // 2
        boys = students_total - half
        girls = half

    json_schema = {
        "header": {
            "school_name": school_name,
            "teacher_name": teacher_name,
            "class_name": class_name,
            "subject": subject_label,
            "topic": topic,
            "subtopic": subtopic_display,
            "date": today,
            "time_from": "08:00",
            "time_to": time_to,
            "period": period,
            "duration_minutes": duration_minutes,
            "number_of_students": students_total,
            "students_registered": {"boys": boys, "girls": girls, "total": students_total},
            "students_present": {"boys": "", "girls": "", "total": ""},
            "students_absent": {"boys": "", "girls": "", "total": ""},
        },
        "competence_architecture": {
            "main_competence": main_comp_hint,
            "specific_competence": spec_comp_hint,
            "main_learning_activity": "Students apply the laws of indices to simplify numerical and algebraic expressions",
            "specific_learning_activity": (
                "Define the laws of indices and apply them to simplify expressions"
            ),
            "lesson_objective": (
                "By the end of this 40-minute lesson, the learner should be able to "
                "identify and apply the laws of indices accurately"
            ),
        },
        "resources_strategies": {
            "teaching_learning_resources": [
                f"TIE {subject_label} Textbook Form {form_level}, pp. XX-YY", "Specific chart/material"
            ],
            "references": [
                f"TIE ({datetime.now(timezone.utc).year}). {subject_label} for Secondary Schools "
                f"Student's Book Form {form_level}, pp. XX-YY. Dar es Salaam: TIE."
            ],
            "learning_environment": "Collaborative group layout with accessible learning materials",
        },
        "progression_matrix": [
            {"stage": "Introduction", "time": "10 min", "core_content": "Prior knowledge foundation",
             "teacher_activity": "...", "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Competence Development", "time": "30 min", "core_content": "Core concepts and definitions",
             "teacher_activity": "...", "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Design", "time": "20 min", "core_content": "Practical application and synthesis",
             "teacher_activity": "...", "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Realizations", "time": "20 min", "core_content": "Presentation and consolidation",
             "teacher_activity": "...", "learner_activity": "...", "assessment_criteria": "..."},
        ],
        "evaluation_learners": (
            "[To be completed after lesson: e.g., 38 out of 45 students successfully "
            "modeled the concept. 7 students struggled with application.]"
        ),
        "evaluation_teacher": (
            "[To be completed after lesson: e.g., Group work in Competence Development "
            "was effective. Design phase required extra 5 minutes.]"
        ),
        "remarks": "",
    }

    if lang == "sw":
        return (
            "Unatengeneza Mpango wa Somo rasmi wa TIE (Taasisi ya Elimu Tanzania) "
            "kwa Misingumo ya Ujuzi (Competence-Based Curriculum).\n"
            "MUHIMU SANA: Toa JSON SAHIHI pekee — bila markdown, maelezo, au vizuizi vya msimbo.\n\n"
            f"MISEMBO:\n{json.dumps(json_schema, indent=2, ensure_ascii=False)}\n\n"
            f"CONTEXTO YA MPANGO:\n{curriculum_ctx}\n\n"
            "Muundo lazima ufuate umbizo rasmi la TIE: Taarifa za Awali, Maelezo ya Ujuzi, "
            "Rasilimali za Kufundisha na Kujifunza, na Mchakato wa Kufundisha na Kujifunza "
            "kwa HATUA 4 haswa: Utangulizi, Ukuzaji wa Ujuzi, Usanifu, na Utambuzi, "
            "kila hatua ikiwa na Shughuli ya Ufundishaji, Shughuli ya Kujifunza, na "
            "Kigezo cha Tathmini.\n"
            f"{rules_sw}\n"
            f"{real_comp_block}\n"
            f"{reference_block}\n"
            f"Urefu wa somo ni dakika {duration_minutes}; gauza hatua nne kwa busara "
            "ndani ya muda huo (Utangulizi mfupi zaidi, Ukuzaji wa Ujuzi ndio mrefu "
            "zaidi), si mgawanyo usiobadilika.\n"
            f"Lugha: Kiswahili"
        )

    return (
        "You are generating an official Tanzania Institute of Education (TIE) "
        "Competence-Based Lesson Plan.\n"
        "CRITICAL: Output ONLY valid JSON matching this schema — no markdown, no explanations.\n\n"
        f"JSON SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        "Follow the official TIE 4-block lesson plan format: Preliminary Information, "
        "Competence Information, Teaching & Learning Resources, and the Teaching & "
        "Learning Process.\n"
        f"{rules}\n"
        f"{real_comp_block}\n"
        f"{reference_block}\n"
        f"The lesson length is {duration_minutes} minutes; allocate the four stages "
        "sensibly within that total (Introduction shortest, Competence Development the "
        "longest), rather than forcing a fixed split.\n"
        "Language: English"
    )