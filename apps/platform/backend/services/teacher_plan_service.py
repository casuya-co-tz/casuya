"""Teacher plan service — AI-powered lesson plan and scheme of work generation.

Generates official TIE competence-based curriculum documents as structured
JSON, with print-quality HTML rendering for PDF/Word export.

Language-aware: Kiswahili-medium subjects (Kiswahili, Historia ya Tanzania
na Maadili, etc.) produce Kiswahili output; all other subjects produce
English output.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from backend.data.tie_competences import lookup_competence
from backend.data.tie_syllabus import find_by_keyword as ts_find_by_keyword
from backend.data.tie_syllabus import get_specific_competences as ts_get_specific_competences
from backend.services.ai_service import _call_ai_service
from backend.services.reference_library_service import (
    fetch_reference_grounding,
    lesson_plan_grounding,
    scheme_of_work_grounding,
)
from backend.services.syllabus_service import get_curriculum_context, get_subject_with_form

logger = logging.getLogger(__name__)

KISWAHILI_SUBJECTS = {
    "kiswahili",
    "historia-ya-tanzania-na-maadili",
    "historia ya tanzania na maadili",
    "civics",
    "elimu-ya-dini-islamu",
    "uraia-na-maadili",
}


def _is_kiswahili(subject_slug: str) -> bool:
    return subject_slug.lower().strip() in KISWAHILI_SUBJECTS


def _lang_label(subject_slug: str) -> str:
    return "sw" if _is_kiswahili(subject_slug) else "en"


def _tie_competences(subject_slug: str, form_level: int, topic_title: str, lang: str):
    """Return (main_competence, specific_competence) verbatim TIE statements.

    Looks up the official TIE CBC (2023) competence for the given subject /
    form / topic and formats it as "<code> <statement>". Returns (None, None)
    when the subject or topic is not in the curated mapping so callers can
    gracefully fall back to their existing behaviour.
    """
    rec = lookup_competence(subject_slug, form_level, topic_title)
    if not rec:
        return None, None
    return (
        f"{rec['main_code']} {rec['main'][lang]}".strip(),
        f"{rec['specific_code']} {rec['specific'][lang]}".strip(),
    )


def _time_to(duration_minutes: int) -> str:
    base = datetime(2026, 1, 1, 8, 0)
    from datetime import timedelta
    end = base + timedelta(minutes=duration_minutes)
    return end.strftime("%H:%M")


def _strip_think_tags(text: str) -> str:
    text = re.sub(r" thinking[\s\S]*?</think>", "", text).strip()
    if " thinking" in text:
        parts = text.split(" thinking")
        text = parts[-1].strip()
    return text


def _parse_plan_json(raw: str) -> dict | None:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def _is_complete_lesson_plan(plan) -> bool:
    """Accept an AI-generated lesson plan only when it has the domain structure
    the renderer needs. Anything less (e.g. a Headers-only or explanation
    payload) is rejected so the generator falls back to the offline builder."""
    if not isinstance(plan, dict):
        return False
    if not isinstance(plan.get("header"), dict):
        return False
    ca = plan.get("competence_architecture")
    if not isinstance(ca, dict) or not (ca.get("main_competence") or "").strip():
        return False
    if not (ca.get("specific_competence") or "").strip():
        return False
    return isinstance(plan.get("progression_matrix"), list) and bool(plan["progression_matrix"])


def _is_complete_scheme(plan) -> bool:
    """Accept an AI-generated scheme of work only when it carries weeks."""
    if not isinstance(plan, dict):
        return False
    if not isinstance(plan.get("header"), dict):
        return False
    return isinstance(plan.get("weeks"), list) and bool(plan["weeks"])


def _fill_lesson_plan_placeholders(
    plan: dict,
    *,
    topic_code: str,
    topic_title: str,
    sub_code: str,
    sub_title: str,
    duration_minutes: int,
) -> dict:
    """Replace leftover literal '{}' tokens (which the model sometimes copies
    verbatim from the prompt instead of substituting values) with the real
    syllabus values. Applied recursively across the whole plan so the stored
    JSON and its print HTML never leak raw placeholders like '{topic_code}'.
    """
    values = {
        "{topic_code}": topic_code or "",
        "{topic_title}": topic_title or "",
        "{subtopic_code}": sub_code or "",
        "{subtopic_title}": sub_title or "",
        "{duration}": str(duration_minutes),
        "{duration_minutes}": str(duration_minutes),
    }

    def _fill(value):
        if isinstance(value, str):
            out = value
            for k, v in values.items():
                out = out.replace(k, v)
            return out
        if isinstance(value, list):
            return [_fill(i) for i in value]
        if isinstance(value, dict):
            return {k: _fill(v) for k, v in value.items()}
        return value

    return _fill(plan)


async def generate_lesson_plan(
    *,
    subject_slug: str,
    form_level: int,
    topic: str,
    subtopic: str | None = None,
    school_name: str | None = None,
    teacher_name: str | None = None,
    number_of_students: int | None = None,
    students_boys: int | None = None,
    students_girls: int | None = None,
    duration_minutes: int = 40,
    period: str | None = None,
) -> dict:
    lang = _lang_label(subject_slug)
    curriculum_ctx = get_curriculum_context(subject_slug, form_level)
    subject_label = subject_slug.replace("-", " ").title()

    prompt = _build_lesson_plan_prompt(
        lang=lang,
        curriculum_ctx=curriculum_ctx,
        subject_label=subject_label,
        form_level=form_level,
        topic=topic,
        subtopic=subtopic or "",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        number_of_students=number_of_students or 40,
        students_boys=students_boys,
        students_girls=students_girls,
        duration_minutes=duration_minutes,
        period=period or "Period 1",
    )

    result = await _call_ai_service("/api/plans/lesson-plan", {
        "question": prompt,
        "prompt": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
        "topic": topic,
        "subtopic": subtopic or "",
        "school_name": school_name or "School Name",
        "teacher_name": teacher_name or "Teacher Name",
        "number_of_students": number_of_students or 40,
        "students_boys": students_boys,
        "students_girls": students_girls,
        "duration_minutes": duration_minutes,
        "period": period or "Period 1",
        "lang": lang,
    })

    # Resolve the real syllabus codes/titles so any leftover '{}' placeholder
    # tokens in the AI output can be filled with authentic values.
    topic_code = topic_title = ""
    sub_code = sub_title = subtopic or ""
    try:
        subject_data = get_subject_with_form(subject_slug, form_level)
        topic_code, sub_code, sub_title = _build_lesson_plan_topic_codes(
            subject_data, topic, subtopic or "", lang)
        topic_title = topic
        for tp in (subject_data or {}).get("topics", []):
            if (tp.get("title") or "").strip().lower() == (topic or "").strip().lower() or \
               (tp.get("code") or "").strip().lower() == (topic or "").strip().lower():
                topic_title = tp.get("title") or topic
                break
    except Exception:
        logger.warning("Could not resolve syllabus codes for placeholder fill", exc_info=True)

    plan = None
    if isinstance(result, dict) and _is_complete_lesson_plan(result):
        plan = result
    elif isinstance(result, dict) and "response" in result:
        raw = _strip_think_tags(result["response"])
        parsed = _parse_plan_json(raw)
        if _is_complete_lesson_plan(parsed):
            plan = parsed

    if plan is not None:
        tie_main, tie_spec = _tie_competences(subject_slug, form_level, topic, lang)
        if tie_main and tie_spec:
            ca = plan.setdefault("competence_architecture", {})
            ca["main_competence"] = tie_main
            ca["specific_competence"] = tie_spec
        plan.setdefault("header", {})
        plan["header"]["school_name"] = plan["header"].get("school_name") or (school_name or "School Name")
        plan["header"]["teacher_name"] = plan["header"].get("teacher_name") or (teacher_name or "Teacher Name")
        plan["header"]["class_name"] = plan["header"].get("class_name") or f"Form {form_level}"
        return _fill_lesson_plan_placeholders(
                plan,
                topic_code=topic_code,
                topic_title=topic_title,
                sub_code=sub_code,
                sub_title=sub_title,
                duration_minutes=duration_minutes,
            )

    return _build_lesson_plan_offline(
        subject_slug=subject_slug,
        subject_label=subject_label,
        form_level=form_level,
        topic=topic,
        subtopic=subtopic or "",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        number_of_students=number_of_students or 40,
        students_boys=students_boys,
        students_girls=students_girls,
        duration_minutes=duration_minutes,
        period=period or "Period 1",
        lang=lang,
    )


def plan_lessons_for_subtopic(
    *,
    subject_slug: str,
    form_level: int,
    topic: str,
    subtopic: str,
    school_name: str | None = None,
    teacher_name: str | None = None,
    number_of_students: int | None = None,
    students_boys: int | None = None,
    students_girls: int | None = None,
    duration_minutes: int = 40,
    period: str | None = None,
) -> list[dict]:
    """Generate one lesson plan per teaching period for a subtopic.

    The number of lesson plans is determined by the subtopic's period weight,
    distributed across its specific learning activities exactly as the scheme of
    work does via ``_distribute_periods``.  Each learning activity that is
    allocated *N* periods produces *N* individual lessons, each focused on that
    specific learning activity, so the total number of lessons equals the
    subtopic's total allocated periods.
    """
    lang = _lang_label(subject_slug)
    subject_label = subject_slug.replace("-", " ").title()

    # Resolve the topic + subtopic in the authentic syllabus so the schedule and
    # lesson content match the honest per-period allocation from the scheme.
    outcomes: list[str] = []
    spec_periods = 0

    # Preferred source: the matching Scheme-of-Work teaching row (derived from
    # the verbatim TIE syllabus). Its derived (i)/(ii)/(iii) specific activities
    # become the per-period lesson foci and its period split sets the count,
    # exactly mirroring the scheme the teacher planned.
    scheme_row = _scheme_row_for_lesson(subject_slug, form_level, topic, subtopic, lang)
    if scheme_row:
        spec_periods = scheme_row.get("periods") or 0
        sas = scheme_row.get("specific_activities") or []
        outcomes = [_strip_item_marker(s) for s in sas]
        outcomes = [o for o in outcomes if o]
        if not outcomes and scheme_row.get("learning_activities"):
            outcomes = [scheme_row["learning_activities"]]
    else:
        try:
            subject_data = get_subject_with_form(subject_slug, form_level)
        except Exception:
            subject_data = None

        if subject_data and subject_data.get("topics"):
            t = (topic or "").strip().lower()
            for tp in subject_data["topics"]:
                title = (tp.get("title") or "").strip().lower()
                code = (tp.get("code") or "").strip().lower()
                if t and (t in title or title in t or t == code):
                    subtopic_list = tp.get("subtopics") or []
                    st = (subtopic or "").strip().lower()
                    for sp in subtopic_list:
                        s_title = (sp.get("title") or "").strip().lower()
                        s_code = (sp.get("code") or "").strip().lower()
                        if st and (st in s_title or s_title in st or st == s_code):
                            outcomes = [
                                o.get("description", "").strip()
                                for o in (sp.get("outcomes") or [])
                                if o.get("description", "").strip()
                            ]
                            spec_periods = sp.get("estimated_periods") or 0
                            break
                    break

    if spec_periods <= 0:
        spec_periods = 1
    if not outcomes:
        outcomes = [
            f"Explain the basic concepts of {subtopic or topic}",
            f"Apply {subtopic or topic} in different contexts",
        ]
        if lang == "sw":
            outcomes = [
                f"Eleza dhana za msingi za {subtopic or topic}",
                f"Tumia {subtopic or topic} katika miktadha mbalimbali",
            ]

    schedule = _distribute_periods(outcomes, spec_periods)

    lessons: list[dict] = []
    for entry in schedule:
        activity = entry["activity"]
        periods = entry["periods"]
        for idx in range(1, periods + 1):
            lessons.append(_build_lesson_plan_offline(
                subject_slug=subject_slug,
                subject_label=subject_label,
                form_level=form_level,
                topic=topic,
                subtopic=subtopic,
                school_name=school_name or "School Name",
                teacher_name=teacher_name or "Teacher Name",
                number_of_students=number_of_students or 40,
                students_boys=students_boys,
                students_girls=students_girls,
                duration_minutes=duration_minutes,
                period=period or "Period",
                lang=lang,
                learning_activity=activity,
                lesson_number=idx,
                lesson_total=periods,
            ))

    return lessons


async def generate_scheme_of_work(
    *,
    subject_slug: str,
    form_level: int,
    term: str,
    academic_year: str | None = None,
    school_name: str | None = None,
    teacher_name: str | None = None,
    topics: list[str] | None = None,
) -> dict:
    lang = _lang_label(subject_slug)
    curriculum_ctx = get_curriculum_context(subject_slug, form_level)
    subject_label = subject_slug.replace("-", " ").title()

    prompt = _build_scheme_prompt(
        lang=lang,
        curriculum_ctx=curriculum_ctx,
        subject_label=subject_label,
        form_level=form_level,
        term=term,
        academic_year=academic_year or "2026",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        topics=topics or [],
    )

    result = await _call_ai_service("/api/plans/scheme-of-work", {
        "question": prompt,
        "prompt": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
        "term": term,
        "academic_year": academic_year or "2026",
        "school_name": school_name or "School Name",
        "teacher_name": teacher_name or "Teacher Name",
        "topics": topics or [],
        "lang": lang,
    })

    plan = None
    if isinstance(result, dict) and _is_complete_scheme(result):
        plan = result
    elif isinstance(result, dict) and "response" in result:
        raw = _strip_think_tags(result["response"])
        parsed = _parse_plan_json(raw)
        if _is_complete_scheme(parsed):
            plan = parsed

    if plan is not None:
        h = plan.setdefault("header", {})
        h.setdefault("school_name", school_name or "School Name")
        h.setdefault("teacher_name", teacher_name or "Teacher Name")
        h.setdefault("subject", subject_label)
        h.setdefault("class_name", f"Form {form_level}")
        h.setdefault("term", term)
        h.setdefault("academic_year", academic_year or "2026")
        return plan

    return _build_scheme_offline(
        subject_slug=subject_slug,
        subject_label=subject_label,
        form_level=form_level,
        term=term,
        academic_year=academic_year or "2026",
        school_name=school_name or "School Name",
        teacher_name=teacher_name or "Teacher Name",
        topics=topics or [],
        lang=lang,
    )


def _build_lesson_plan_prompt(
    *, lang, curriculum_ctx, subject_label, form_level, topic, subtopic,
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
            "main_competence": "1.1 INDICES AND LOGARITHMS (use the real topic code and title from the curriculum context for THIS lesson)",
            "specific_competence": "1.1.1 LAWS OF INDICES (use the real subtopic code and title from the curriculum context for THIS lesson)",
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
        f"The lesson length is {duration_minutes} minutes; allocate the four stages "
        "sensibly within that total (Introduction shortest, Competence Development the "
        "longest), rather than forcing a fixed split.\n"
        "Language: English"
    )


# Shared, authoritative rules for producing lesson plans that match the official
# TIE (Tanzania Institute of Education) competence-based format.
_TIE_LESSON_PLAN_RULES_EN = (
    "HARD RULES (must all hold):\n"
    "1. Competences carry their syllabus codes: main_competence = '{topic_code} {topic_title}', "
    "specific_competence = '{subtopic_code} {subtopic_title}'. Never omit the codes.\n"
    "2. main_learning_activity is the topic's broad learning narrative (from the syllabus "
    "context); specific_learning_activity is the SINGLE specific learning activity/outcome "
    "focused on this lesson, written as a concise outcome phrase (e.g. \"Define hyperbolic "
    "functions and their properties\"). It must NOT be a time-boxed sentence such as "
    "\"Within N minutes...\".\n"
    "3. Use exactly the four official stage names, in order: Introduction, Competence "
    "Development, Design, Realizations (always plural \"Realizations\").\n"
    "4. Each stage's assessment_criteria must echo THIS lesson's specific_learning_activity "
    "using the fixed TIE verb pattern, ending with the exact activity phrase:\n"
    "   - Introduction: \"Students identify prior knowledge related to <activity>.\"\n"
    "   - Competence Development: \"Students accurately demonstrate understanding of <activity>.\"\n"
    "   - Design: \"Students correctly apply concepts and skills related to <activity>.\"\n"
    "   - Realizations: \"Students confidently justify outcomes related to <activity>.\"\n"
    "5. Only use topics/subtopics/outcomes present in the curriculum context. Never invent "
    "content; if the requested topic/subtopic is absent, say so instead of fabricating.\n"
    "6. References must cite the real TIE book (subject, year, form); resources and learning "
    "environment must come from the syllabus context.\n\n"
    "SQAD AUDIT COMPLIANCE — 100% QUALITY FOR MINISTRY OF EDUCATION INSPECTION:\n"
    "7. CURRICULUM AUTHENTICITY: Main Competence, Specific Competence, and Main Learning "
    "Activity must be VERBATIM from the TIE syllabus — word-for-word, not paraphrased. "
    "The Specific Learning Activity must be a deconstructed micro-chunk of the Main Activity.\n"
    "8. STUDENT ATTENDANCE MATRIX: Fill students_present with actual numbers (boys, girls, "
    "total). Leave students_absent as the remainder (registered minus present). This creates "
    "the 3-column SQAD attendance table (Registered / Present / Absent).\n"
    "9. LESSON OBJECTIVE: Write a SMART objective sentence that starts with \"By the end "
    "of this {duration_minutes}-minute lesson, the learner should be able to\" followed by a "
    "measurable action verb (identify, define, calculate, construct, explain, demonstrate, "
    "classify, analyze) and the lesson's specific subject matter from the curriculum context, "
    "ending with \"accurately\". For example: \"By the end of this 40-minute lesson, the "
    "learner should be able to identify and apply the laws of indices accurately.\" "
    "Fill in the real, specific content — never leave bracketed placeholders in the final "
    "objective. Never use vague verbs like 'understand' or 'know'.\n"
    "10. CORE CONTENT per stage: Each of the 4 progression stages must include a "
    "core_content field stating the key knowledge/skill addressed in that stage "
    "(e.g. \"Prior knowledge foundation\", \"Core definitions and formulas\", "
    "\"Practical application\", \"Presentation and consolidation\").\n"
    "11. OPERATIONAL SOURCING: Resources must be SPECIFIC — cite exact textbook titles "
    "with form level (e.g. \"TIE Mathematics for Secondary Schools Form 2, pp. 45-48\"), "
    "actual tools (rulers, calculators, specimens), actual materials (charts, worksheets, "
    "lab equipment). Never list generic placeholders like \"Chalk and Blackboard\" or "
    "\"various resources\".\n"
    "12. REFERENCES FORMAT: Must follow academic citation: Author (Year). Title. City: "
    "Publisher, Pages. Example: \"TIE (2023). Mathematics for Secondary Schools "
    "Student's Book Form 2, pp. 45-48. Dar es Salaam: TIE.\"\n\n"
    "CONTENT QUALITY — YOU ARE AN EXPERT CURRICULUM WRITER, NOT A DATA COPIER:\n"
    "13. NEVER copy-paste raw syllabus bullet points into activities. TRANSFORM them "
    "into complete, professional sentences that a real teacher would write. Each activity "
    "description must be a full, grammatically correct sentence with proper subject-verb "
    "agreement, punctuation, and professional tone.\n"
    "14. Teacher activities must describe CONCRETE ACTIONS the teacher performs: "
    "\"Guides students through...\", \"Demonstrates...\", \"Facilitates group work on...\", "
    "\"Assigns individual practice...\", \"Collects and reviews...\". Avoid vague phrases "
    "like \"Teaches about...\" or \"Covers the topic of...\".\n"
    "15. Learner activities must describe CONCRETE ACTIONS the student performs: "
    "\"Identifies...\", \"Discusses in pairs...\", \"Completes...\", \"Writes...\", "
    "\"Presents findings...\". Avoid passive or vague phrases like \"Learns about...\".\n"
    "16. Grammar and spelling: every sentence must be grammatically correct, properly "
    "punctuated, and free of spelling errors. Use formal academic English. Avoid "
    "contractions (don't → do not, can't → cannot). Use consistent terminology "
    "throughout (don't switch between 'students', 'learners', 'pupils' randomly).\n"
    "17. EVALUATION SECTION: Include an evaluation field with two parts left as "
    "placeholders for handwritten completion after teaching:\n"
    "    - evaluation_learners: \"[To be completed after lesson: e.g., 38 out of 45 "
    "students successfully modeled the concept. 7 students struggled with application "
    "due to computation errors.]\"\n"
    "    - evaluation_teacher: \"[To be completed after lesson: e.g., Group work in "
    "Competence Development was effective. Design phase required extra 5 minutes. "
    "Future sessions will feature tighter task transitions.]\"\n"
    "18. Before outputting the JSON, silently evaluate your work against these checks:\n"
    "    a. Are all 4 competences present, non-empty, and verbatim from syllabus?\n"
    "    b. Does specific_learning_activity contain a real, concise outcome (not generic)?\n"
    "    c. Is lesson_objective a SMART sentence with a measurable verb?\n"
    "    d. Do all 4 assessment criteria echo the specific activity correctly?\n"
    "    e. Does each stage have a core_content field?\n"
    "    f. Are teacher and learner activities concrete and different from each other?\n"
    "    g. Are resources specific with textbook pages (not placeholders)?\n"
    "    h. Are references in academic citation format (Author, Year, Title, City, Pages)?\n"
    "    i. Is evaluation_learners and evaluation_teacher present as placeholders?\n"
    "    j. Is every sentence grammatically correct and professionally written?\n"
    "   If any check fails, FIX the issue before outputting. Do NOT output incomplete "
    "or low-quality content.\n"
)


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


# Kiswahili translation of the shared TIE lesson-plan rules.
_TIE_LESSON_PLAN_RULES_SW = (
    "KANUNI ZISIZOBADILISHA (lazima zote zitimie):\n"
    "1. Ujuzi hubeba misimbo ya misingumo: ujuzi mkuu = '{topic_code} {topic_title}', "
    "ujuzi mahususi = '{subtopic_code} {subtopic_title}'. Usiachie misimbo.\n"
    "2. Shughuli kuu ni maelezo mapana ya kujifunza kwa mada (kutoka misingumo); "
    "shughuli mahususi ni SHUGHULI MAHUSUSI MOJA ya kujifunza inayolenga somo hili, "
    "ikiandikwa kama kishazi fupi cha matokeo (mf. \"Fafanua sifa za vitendakazi "
    "hyperbolic\"). INAFAAANA SI kishazi chenye muda kama \"Ndani ya dakika N...\".\n"
    "3. Tumia haswa majina manne rasmi ya hatua kwa utaratibu: Utangulizi, Ukuzaji wa "
    "Ujuzi, Usanifu, na Utambuzi.\n"
    "4. Kigezo cha tathmini cha kila hatua lazima kirejee shughuli mahususi ya somo "
    "hili kwa mtindo usiobadilika, kikimalizika na kishazi cha shughuli:\n"
    "   - Utangulizi: \"Wanafunzi hutambua maarifa ya awali yanayohusu <shughuli>.\"\n"
    "   - Ukuzaji wa Ujuzi: \"Wanafunzi huonyesha kwa usahihi uelewa wa <shughuli>.\"\n"
    "   - Usanifu: \"Wanafunzi hutumia kwa usahihi dhana na ujuzi unaohusu <shughuli>.\"\n"
    "   - Utambuzi: \"Wanafunzi wanathibitisha kwa imani matokeo yanayohusu <shughuli>.\"\n"
    "5. Tumia tu mada/sehemu za mada/matokeo yaliyopo kwenye misingumo. Usibuni "
    "maudhui; kama mada au sehemu ya mada haipo, sema hivyo badala ya kubuni.\n"
    "6. Marejeo lazima yanukuu kitabu rasmi cha TIE (somo, mwaka, kidato); rasilimali na "
    "mazingira ya kujifunzia lazima vitoke kwenye misingumo.\n\n"
    "UFUATILIAJI WA UKAGUZI WA SQAD — UBORA WA 100% KWA UKAGUZI WA WIZARA YA ELIMU:\n"
    "7. UHALISI WA MTAALA: Ujuzi Mkuu, Ujuzi Mahususi, na Shughuli Kuu lazima ziwe "
    "KAMILI KWA MANENO kutoka misingumo ya TIE — maneno kwa maneno, si kwa maelezo. "
    "Shughuli Mahususi lazima iwe kichwa kidogo kilichogawanywa kutoka Shughuli Kuu.\n"
    "8. ODHOSHA YA WAFUATILIAJI: Jaza students_present kwa nambari halisi (wavulana, "
    "wasichana, jumla). Acha students_absent kama zilizoachwa (zilizosajiliwa "
    "kuzidisha zilizopo). Hii inaunda meza ya 3 kolamu ya SQAD (Zilizosajiliwa / "
    "Zilizopo / Zilizokosekana).\n"
    "9. LENGO LA SOMO: Andika lengo la SMART kwa muundo: \"Mwisho wa somo hili la "
    "dakika {duration_minutes}, mwanafunzi anapaswa kuwa na uwezo wa [KITENDO CHA "
    "SMART] [mada mahususi] kwa usahihi.\" Tumia vitendo vinavyoweza kupimika: "
    "tambua, fafanua, hesabu, jenga, eleza, onyesha, mgawanyiko, uchambuzi. Usitumie "
    "maneno ya kawaida kama \"elewa\" au \"jua\".\n"
    "10. MWALIMU WA KILA HATUA: Kila hatua ya mchakato wa hatua 4 lazima iwe na "
    "sehemu ya core_content inayoeleza ujuzi mkuu/ujuzi unaoshughulikiwa katika "
    "hatua hiyo (mf. \"Maarifa ya awali\", \"Dhana na vipengele vya msingi\", "
    "\"Matumizi ya vitendo\", \"Uonyeshaji na ukomavu\").\n"
    "11. VIFAA VYA KUTUMIA: Rasilimali lazima ziwe MAHALUSI — nachukua vitabu halisi "
    "vyenye jina la somo na kidato (mf. \"TIE Hisabati kwa Shule za Sekondari "
    "Kidato 2, uk. 45-48\"), vifaa halisi (vipimo, kompyuta, samani za maabara), "
    "na vifaa halisi (chanti, karatazi za kazi, vifaa vya maabara). Usiorodheshe "
    "sehemu za kujaza kama \"Bao na Ubao\" au \"asilimia mbalimbali\".\n"
    "12. MUUNDO WA MAREJEO: Lazima ufuate muundo wa kitaaluma: Mwandishi (Mwaka). "
    "Kichwa. Jiji: Mchapishaji, Ukurasa. Mfano: \"TIE (2023). Hisabati kwa Shule "
    "za Sekondari Kitabu cha Mwanafunzi Kidato 2, uk. 45-48. Dar es Salaam: TIE.\"\n\n"
    "UBORA WA MAUDHUI — Wewe ni MWANDISHI wa mtaalamu wa mtaala, SI NAKALA YA DATA:\n"
    "13. USINAKILI pointi ghafi za misingumo moja kwa moja kwenye shughuli. ZIBADILISHE "
    "kuwa sentensi kamili, za kitaalamu ambazo mwalimu halisi angeschandikwa. Kila "
    "maelezo ya shughuli lazima yawe sentensi yenye kiini chake, miliya sahihi, na "
    "mtindo wa kitaalamu.\n"
    "14. Shughuli za mwalimu lazima zieleze HATUA ZA WATENDAJI ambazo mwalimu anafanya: "
    "\"Anaongoza wanafunzi kupitia...\", \"Anaonyesha...\", \"Anarahisisha kazi ya "
    "vikundi kuhusu...\", \"Anawapa kazi ya kujifunza peke yao...\", \"Anakusanya na "
    "kukagua...\". Epuka maneno ya kawaida kama \"Anafundisha kuhusu...\" au \"Anashughulikia "
    "mada ya...\".\n"
    "15. Shughuli za mwanafunzi lazima zieleze HATUA ZA WATENDAJI ambazo mwanafunzi "
    "anafanya: \"Anatambua...\", \"Anajadiliana na rafiki yake...\", \"Anakamilisha...\", "
    "\"Anaandika...\", \"Anaonyesha matokeo...\". Epuka maneno ya kawaida kama \"Anajifunza "
    "kuhusu...\".\n"
    "16. Lugha na uandishi: kila sentensi lazima iwe sahihi kwa sarufi, yenye alama "
    "sahihi, na bila makosa ya herufi. Tumia Kiswahili rasmi, cha kitaalamu. Epuka "
    "vipindi (si → si, havija → havija). Tumia maneno sawia kote.\n"
    "17. SEHEMU YA TATHMINI: Jumuishisha sehemu ya evaluation yenye sehemu mbili "
    "zilizoachwa kwa uandishi wa mkono baada ya somo:\n"
    "    - evaluation_learners: \"[Itakamilishwa baada ya somo: mf., Wanafunzi 38 "
    "kati ya 45 walifanikiwa kuunda dhana. Wanafunzi 7 walipata matatizo.]\"\n"
    "    - evaluation_teacher: \"[Itakamilishwa baada ya somo: mf., Kazi ya vikundi "
    "katika Ukuzaji wa Ujuzi ilikuwa nzuri. Hatua ya Usanifu ilihitaji dakika 5 "
    "za ziada.]\"\n"
    "18. Kabla ya kutoa JSON, fanya ukaguzi wa kimyakimya dhidi ya ukaguzi huu:\n"
    "    a. Je, ujuzi wote 4 upo, haujaa, na ni kamili kwa maneno kutoka misingumo?\n"
    "    b. Je, shughuli mahususi ina matokeo halisi, fupi (si ya kawaida)?\n"
    "    c. Je, lenjo la somo ni sentensi yenye kitendo kinachoweza kupimika?\n"
    "    d. Je, vigezo vya tathmini vya hatua zote 4 vinaerejea shughuli mahususi "
    "kwa usahihi?\n"
    "    e. Je, kila hatua ina sehemu ya core_content?\n"
    "    f. Je, shughuli za mwalimu na mwanafunzi ni za vitendo na tofauti kwa "
    "mwendo?\n"
    "    g. Je, rasilimali ni mahalusi na zina ukurasa wa kitabu (si sehemu za kujaza)?\n"
    "    h. Je, marejeo ni kwa muundo wa kitaaluma (Mwandishi, Mwaka, Kichwa, "
    "Jiji, Ukurasa)?\n"
    "    i. Je, evaluation_learners na evaluation_teacher zipo kama sehemu za kujaza?\n"
    "    j. Je, kila sentensi ni sahihi kwa sarufi na imeandikwa kitaalamu?\n"
    "   Kama ukaguzi yoyote unashindwa, SAHISHA tatizo kabla ya kutoa. USITOE "
    "maudhui yasiyo kamili au ya ubora wa chini.\n"
)


# Shared TIE rules for producing an authentic scheme of work.
_TIE_SCHEME_RULES_EN = (
    "\nHARD RULES (must all hold):\n"
    "1. PERIOD INTEGRITY: a topic's total periods MUST equal the sum of its "
    "subtopics' periods; the subject's total for the class MUST equal the sum of "
    "all subtopics' periods. Never add to or reduce the periods the syllabus "
    "allocates — the scheme only decides HOW each allocated period is used.\n"
    "2. COMPETENCES carry syllabus codes: main = '{topic code} {topic title}', "
    "specific = '{subtopic code} {subtopic title}'.\n"
    "3. LEARNING ACTIVITIES: list the exact learning activities (outcomes) from the "
    "curriculum context for each subtopic; distribute that subtopic's allocated "
    "periods across them so each activity gets its period weight.\n"
    "4. CALENDAR: 2 terms — Term I = Jan–May, Term II = Jul–Nov, 4 weeks/month. "
    "Insert exactly TWO non-teaching weeks at each term's midpoint with periods=0: "
    "'MIDTERM EXAMINATION' and 'MIDTERM HOLIDAY'. Week numbers stay continuous.\n"
    "5. AUTHENTICITY: use only topics/subtopics/outcomes present in the curriculum "
    "context. Never invent topics or period counts. References cite the real TIE "
    "book (subject, year, form).\n"
    "6. Output valid JSON matching the schema; no extra prose.\n\n"
    "SQAD AUDIT COMPLIANCE — 100% QUALITY FOR MINISTRY OF EDUCATION INSPECTION:\n"
    "7. 12-COLUMN FORMAT: The scheme must contain exactly 12 columns in this order: "
    "Month, Week, Main Competence, Specific Competence, Main Learning Activity, "
    "Specific Learning Activity, Number of Periods, Teaching & Learning Activities, "
    "Assessment Criteria, Teaching & Learning Resources, References, Remarks.\n"
    "8. CURRICULUM AUTHENTICITY: Main Competence, Specific Competence, and Main "
    "Learning Activity must be VERBATIM from the TIE syllabus — word-for-word, not "
    "paraphrased. The Specific Learning Activity must be a deconstructed micro-chunk "
    "of the Main Activity.\n"
    "9. COGNITIVE HIERARCHY: Learning objectives must progress from simple tasks in "
    "early weeks to complex competencies in later weeks within a topic. Week 1 of a "
    "topic should cover foundational knowledge; later weeks build toward application "
    "and analysis.\n"
    "10. TEACHING & LEARNING ACTIVITIES: This column must contain SEPARATE actions "
    "for Teacher and Learner — not combined. Format: \"Teacher: [action]. Learner: "
    "[action].\" Never merge them into a single statement.\n"
    "11. REFERENCES FORMAT: Must follow academic citation: Author (Year). Title. "
    "City: Publisher, Pages. Example: \"TIE (2023). Mathematics for Secondary "
    "Schools Student's Book Form 2, pp. 45-48. Dar es Salaam: TIE.\"\n"
    "12. REMARKS: Leave this field as an empty string. It must be handwritten after "
    "teaching with factual statistics (e.g., 'Out of 45 students, 40 performed "
    "successfully. 5 students will receive remedial instruction on 14/02/2026.').\n\n"
    "CONTENT QUALITY — YOU ARE AN EXPERT CURRICULUM PLANNER, NOT A DATA COPIER:\n"
    "13. NEVER copy-paste raw syllabus bullets into learning_activities. TRANSFORM "
    "them into clear, professional outcome statements that a real teacher would "
    "recognise. Each activity must be a complete phrase with proper terminology.\n"
    "14. Teaching methods must be SPECIFIC and PEDAGOGICALLY SOUND: list actual "
    "methods (Group discussion, Problem solving, Demonstration, Think-pair-share, "
    "Laboratory work, Project-based learning). Never list generic placeholders "
    "like 'various methods' or 'mixed approaches'.\n"
    "15. Teaching resources must be SPECIFIC and RELEVANT: list actual textbooks "
    "(title + form + pages), actual tools (rulers, calculators, specimens), actual "
    "materials (charts, worksheets, lab equipment). Never list 'various resources'.\n"
    "16. Assessment tools must be CONCRETE: 'Quizzes, oral questions, written tests, "
    "group presentations, practical demonstrations'. Never list 'various assessments'.\n"
    "17. Grammar and spelling: every sentence must be grammatically correct, properly "
    "punctuated, and free of spelling errors. Use formal academic English. Avoid "
    "contractions (don't → do not, can't → cannot). Use consistent terminology.\n"
    "18. Before outputting the JSON, silently evaluate your work against these checks:\n"
    "    a. Do all topic/subtopic period totals add up correctly?\n"
    "    b. Are all competences present with codes, non-empty, and verbatim from TIE?\n"
    "    c. Are learning activities real outcomes (not fabricated)?\n"
    "    d. Is each row's Main Activity verbatim from TIE and Specific Activity a "
    "deconstructed micro-chunk?\n"
    "    e. Are Teaching & Learning Activities split into separate Teacher/Learner actions?\n"
    "    f. Are teaching methods specific (not generic placeholders)?\n"
    "    g. Are resources specific with textbook pages (not placeholders)?\n"
    "    h. Are references in academic citation format (Author, Year, Title, City, Pages)?\n"
    "    i. Is Remarks field empty (for handwritten entry after teaching)?\n"
    "    j. Does cognitive complexity increase across weeks within each topic?\n"
    "    k. Is every field grammatically correct and professionally written?\n"
    "   If any check fails, FIX the issue before outputting. Do NOT output incomplete "
    "or low-quality content.\n"
)

_TIE_SCHEME_RULES_SW = (
    "\nKANUNI ZISIZOBADILISHA (lazima zote zitimie):\n"
    "1. UADILIFU WA VIPINDI: jumla ya vipindi vya mada LAZIMA ilingane na jumla "
    "ya vipindi vya sehemu zake za mada; jumla ya somo kwa kidato LAZIMA ilingane "
    "na jumla ya vipindi vya sehemu zote za mada. Usiongeze au upunguze vipindi "
    "alivyotenga misingumo — mpango huamua tu JINSI kila kipindi kinavyotumika.\n"
    "2. UJUZI hubeba misimbo ya misingumo: mkuu = '{topic code} {topic title}', "
    "mahususi = '{subtopic code} {subtopic title}'.\n"
    "3. SHUGHULI ZA KUJIFUNZA: orodhesha shughuli halisi (matokeo) kutoka misingumo "
    "kwa kila sehemu ya mada; gauza vipindi vilivyotengwa vya sehemu ya mada kati "
    "yake ili kila shughuli ipate uzito wake wa vipindi.\n"
    "4. KALENDA: muhula 2 — Muhula wa Kwanza = Jan–Mei, wa Pili = Jul–Nov, wiki 4 "
    "kwa mwezi. Ingiza haswa wiki MBILI zisizofundisha katikati ya muhula na "
    "vipindi=0: 'MTIHANI WA MUHULA' na 'LIKIZO LA MUHULA'. Nambari za wiki "
    "zisalie mfululizo.\n"
    "5. UHALISI: tumia tu mada/sehemu za mada/matokeo yaliyopo kwenye misingumo. "
    "Usibuni mada wala hesabu za vipindi. Marejeo yanukuu kitabu rasmi cha TIE "
    "(somo, mwaka, kidato).\n"
    "6. Toa JSON SAHIHI inayolingana na muundo; bila maelezo ya ziada.\n\n"
    "UFUATILIAJI WA UKAGUZI WA SQAD — UBORA WA 100% KWA UKAGUZI WA WIZARA YA ELIMU:\n"
    "7. MUUNDO WA KOLAMU 12: Mpango lazima uwe na kolamu 12 kwa utaratibu huu: "
    "Mwezi, Wiki, Ujuzi Mkuu, Ujuzi Mahususi, Shughuli Kuu ya Kujifunza, Shughuli "
    "Mahususi ya Kujifunza, Idadi ya Vipindi, Shughuli za Kufundisha na Kujifunza, "
    "Vigezo vya Tathmini, Rasilimali za Kufundisha na Kujifunza, Marejeo, Maelezo.\n"
    "8. UHALISI WA MTAALA: Ujuzi Mkuu, Ujuzi Mahususi, na Shughuli Kuu ya Kujifunza "
    "lazima ziwe KAMILI KWA MANENO kutoka misingumo ya TIE — maneno kwa maneno, si "
    "kwa maelezo. Shughuli Mahususi lazima iwe kichwa kidogo kilichogawanywa kutoka "
    "Shughuli Kuu.\n"
    "9. UBORA WA KOGNITIVI: Lengo la kujifunza lazima lianze na kazi rahisi katika "
    "wiki za kwanza na liendelee hadi ujuzi changamano katika wiki za baadaye ndani "
    "ya mada. Wiki ya 1 ya mada lazima ifunike maarifa ya msingi; wiki za baadaye "
    "zijenge hadi matumizi na uchambuzi.\n"
    "10. SHUGHULI ZA KUFUNDISHA NA KUJIFUNZA: Kolamu hii lazima iwe na HATUA ZA "
    "TOFAUTI kwa Mwalimu na Mwanafunzi — si pamoja. Muundo: \"Mwalimu: [hatua]. "
    "Mwanafunzi: [hatua].\" Usiwaunganishe kwa sentensi moja.\n"
    "11. MUUNDO WA MAREJEO: Lazima ufuate muundo wa kitaaluma: Mwandishi (Mwaka). "
    "Kichwa. Jiji: Mchapishaji, Ukurasa. Mfano: \"TIE (2023). Hisabati kwa Shule "
    "za Sekondari Kitabu cha Mwanafunzi Kidato 2, uk. 45-48. Dar es Salaam: TIE.\"\n"
    "12. MAELEZO: Acha sehemu hii kuwa tupu. Lazima iandikwe kwa mkono baada ya "
    "kufundisha na takwima halisi (mf., 'Kati ya wanafunzi 45, 40 walifanikiwa. "
    "Wanafunzi 5 watapata msaada wa ziada tarehe 14/02/2026.').\n\n"
    "UBORA WA MAUDHUI — Wewe ni MTAALAMU wa kupanga mtaala, SI NAKALA YA DATA:\n"
    "13. USINAKILI pointi ghafi za misingumo moja kwa moja kwenye shughuli za "
    "kujifunza. ZIBADILISHE kuwa taarifa wazi, za kitaalamu ambazo mwalimu halisi "
    "angetambua. Kila shughuli lazima iwe kifaa kamili chenye istilahi sahihi.\n"
    "14. Mbinu za kufundisha lazima ziwe MAHALUSI NA ZA PEDAGOJIA: orodhesha mbinu "
    "halisi (Mjadala wa kikundi, Utatuzi wa matatizo, Uonyeshaji, Kazi ya vitanda, "
    "Kazi ya maabara, Kujifunza kwa mradi). Epuka sehemu za kujaza kama "
    "\"mbalimbali\" au \"mchanganyiko wa mbinu\".\n"
    "15. Rasilimali lazima ziwe MAHALUSI NA ZINAZOFAA: orodhesha vitabu halisi "
    "(jina + kidato + ukurasa), vifaa halisi (vipimo, kompyuta, samani za maabara), "
    "na vifaa halisi (chanti, karatazi za kazi, vifaa vya maabara). Usiorodheshe "
    "\"asilimia mbalimbali\".\n"
    "16. Zana za tathmini lazima ziwe ZA KIVITENDO: 'Maswali ya mtihani, maswali "
    "ya mdomo, mitihani ya maandishi, maonyesho ya vikundi, uthibitisho wa "
    "vifaa'. Epuka sehemu za kujaza kama \"zana mbalimbali\".\n"
    "17. Lugha na uandishi: kila sentensi lazima iwe sahihi kwa sarufi, yenye "
    "alama sahihi, na bila makosa ya herufi. Tumia Kiswahili rasmi, cha "
    "kitaalamu. Epuka vipindi (si → si, havija → havija). Tumia maneno "
    "sawia kote.\n"
    "18. Kabla ya kutoa JSON, fanya ukaguzi wa kimyakimya dhidi ya ukaguzi huu:\n"
    "    a. Je, jumla ya vipindi ya mada na sehemu za mada zinaongea?\n"
    "    b. Je, ujuzi wote una misimbo, haunjaa, na ni kamili kwa maneno kutoka TIE?\n"
    "    c. Je, shughuli za kujifunza ni matokeo halisi (si ya kubuni)?\n"
    "    d. Je, Shughuli Kuu katika kila safu ni kamili kutoka TIE na Shughuli "
    "Mahususi ni kichwa kidogo kilichogawanywa?\n"
    "    e. Je, Shughuli za Kufundisha na Kujifunza zimegawanywa kwa hatua za "
    "Tofauti za Mwalimu na Mwanafunzi?\n"
    "    f. Je, mbinu ni mahalusi (si sehemu za kujaza)?\n"
    "    g. Je, rasilimali ni mahalusi na zina ukurasa wa kitabu (si sehemu za kujaza)?\n"
    "    h. Je, marejeo ni kwa muundo wa kitaaluma (Mwandishi, Mwaka, Kichwa, "
    "Jiji, Ukurasa)?\n"
    "    i. Je, sehemu ya Maelezo ni tupu (kwa uandishi wa mkono baada ya kufundisha)?\n"
    "    j. Je, ugumu wa kognitivi unakua kwa wiki ndani ya kila mada?\n"
    "    k. Je, kila sehemu ni sahihi kwa sarufi na imeandikwa kitaalamu?\n"
    "   Kama ukaguzi yoyote unashindwa, SAHISHA tatizo kabla ya kutoa. USITOE "
    "maudhui yasiyo kamili au ya ubora wa chini.\n"
)


def _build_scheme_prompt(
    *, lang, curriculum_ctx, subject_label, form_level, term, academic_year,
    school_name, teacher_name, topics,
) -> str:
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"
    topic_list = "\n".join(f"  - {t}" for t in topics) if topics else "  (Use curriculum context)"

    json_schema = {
        "header": {
            "school_name": school_name,
            "teacher_name": teacher_name,
            "subject": subject_label,
            "class_name": class_name,
            "term": term,
            "academic_year": academic_year,
        },
        "weeks": [
            {
                "main_competence": "Main competence (e.g. 1.0 Demonstrate mastery...)",
                "specific_competence": "Specific competence (e.g. 1.1 Use numerical skills...)",
                "learning_activities": ["Learning activity (a), (b), ..."],
                "specific_activities": "Specific activity description",
                "month": "Month (e.g. February)",
                "week": "Week (e.g. Week 4)",
                "periods": 2,
                "reference": "Reference (e.g. TIE (2023) textbook, Dar es Salaam)",
                "teaching_methods": ["Jigsaw puzzle", "Brainstorming", "Group discussion"],
                "teaching_resources": ["Charts", "Real life objects", "Math Games"],
                "assessment_tools": "Assessment tools (e.g. Quizzes, questions and answers)",
                "remarks": "Remarks",
            }
        ],
    }

    if lang == "sw":
        return (
            "Unatengeneza Mpango wa Kazi wa Somo rasmi wa TIE kwa Misingumo ya Ujuzi.\n"
            "MUHIMU SANA: Toa JSON SAHIHI pekee — bila markdown, maelezo, au vizuizi vya msimbo.\n\n"
            f"MUUNDO:\n{json.dumps(json_schema, indent=2, ensure_ascii=False)}\n\n"
            f"MISEMBO YA MPANGO:\n{curriculum_ctx}\n\n"
            f"MADA ZINAZOHITAJIKA:\n{topic_list}\n\n"
            f"Tengeneza wiki zinazoshughulikia mada zote hapo juu. Kila wiki 3-5 vipindi.\n"
            "Kila wiki lazima iwe na: Ujuzi Mkuu, Ujuzi Mahususi, Shughuli za Kujifunza "
            "(a),(b),(c)...), Shughuli Mahususi, Mwezi, Wiki, Vipindi, Marejeo, Mbinu za "
            "Kufundisha na Kujifunza, Rasilimali za Kufundisha na Kujifunza, Zana za Tathmini, na Maelezo.\n"
            f"{_TIE_SCHEME_RULES_SW}\n"
            f"Lugha: Kiswahili"
        )

    return (
        "You are generating an official TIE Competence-Based Scheme of Work.\n"
        "CRITICAL: Output ONLY valid JSON matching this schema.\n\n"
        f"JSON SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        f"TOPICS TO COVER:\n{topic_list}\n\n"
        "Generate weeks covering ALL topics listed above. Each week: 3-5 periods, one subtopic.\n"
        "Each week MUST include: Main competence, Specific competence, Learning activities "
        "((a),(b),(c)...), Specific activities, Month, Week, Periods, Reference, Teaching and "
        "learning methods, Teaching and learning resources, Assessment tools, and Remarks.\n"
        f"{_TIE_SCHEME_RULES_EN}\n"
        f"Language: English"
    )


# ── Offline fallback generators ────────────────────────────────────────────


def _lookup_lesson_plan_content(subject_slug, form_level, topic, subtopic, lang,
                                duration_minutes, subtopic_display):
    """Pull real competences/activities for a topic+subtopic from the syllabus KB.

    Returns None when the subject is unknown (e.g. no DB) or the topic/subtopic is
    not found, so callers gracefully fall back to the generic scaffolding.
    """
    try:
        subject = get_subject_with_form(subject_slug, form_level)
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


def _build_lesson_plan_offline(
    *, subject_slug, subject_label, form_level, topic, subtopic,
    school_name, teacher_name, number_of_students, students_boys=None, students_girls=None,
    duration_minutes, period, lang,
    learning_activity=None, lesson_number=None, lesson_total=None,
) -> dict:
    # TIE 4-stage progression time allocation (Introduction/Competence
    # Development/Design/Realisation), scaled to the total duration.
    weights = [5, 15, 12, 8]
    total_w = sum(weights)
    times = [
        max(2, round(duration_minutes * w / total_w)) for w in weights
    ]
    # Absorb rounding drift into the Competence Development (longest) stage.
    drift = duration_minutes - sum(times)
    times[1] += drift
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    time_to = _time_to(duration_minutes)
    subtopic_display = subtopic or ("General Overview" if lang == "en" else "Mawazo ya Jumla")
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"

    if students_boys is not None or students_girls is not None:
        half = number_of_students
        boys = students_boys if students_boys is not None else half - (students_girls or 0)
        girls = students_girls if students_girls is not None else half - boys
        total = boys + girls
    else:
        half = number_of_students // 2
        boys = number_of_students - half
        girls = half
        total = number_of_students

    if lang == "sw":
        stage_names = [
            "Utangulizi",
            "Ukuzaji wa Ujuzi",
            "Usanifu",
            "Utambuzi",
        ]
        teacher_acts = [
            f"Anawaonyesha wanafunzi hali/kauli rahisi kuhusu {topic} na kuwauliza kubainisha thamani zisizojulikana kwa kutumia viambishi/herufi.",
            f"Anawaongoza wanafunzi katika makundi kusoma muktadha wa {subtopic_display}, kuunda kauli za aljebra na kutatua hatua kwa hatua.",
            f"Anawapa wanafunzi matatizo ya muktadha na kuwaomba kuunda matatizo yao wenyewe ya {subtopic_display} ili kubadilishana na mwenzao.",
            f"Anawaongoza wanafunzi kufupisha kanuni kuu za {subtopic_display}, kutoa maswali ya kujiondoa (exit ticket) na kugawa kazi ya nyumbani.",
        ]
        learner_acts = [
            "Hutazama kadi za maneno, hujibu maswali ya mdomo na kutambua kiasi kisichojulikana kinachowakilishwa na viambishi.",
            "Katika makundi madogo, hujadili muktadha, hubadilisha maneno kuwa milinganyo na kukokotoa thamani ya kigezo kisichojulikana.",
            "Huunda matatizo binafsi, hubadilishana madaftari na wanafunzi wenzao na kutatua milinganyo zilizoundwa na wenzao.",
            "Hutaja mambo muhimu aliyojifunza, hukamilisha maswali ya kujiondoa binafsi na kuandika kazi ya nyumbani.",
        ]
        assessment = [
            "Wanafunzi hutambua vigezo visivyojulikana kwa usahihi kutoka kwenye kauli zilizopewa.",
            "Milinganyo huundwa na kutatuliwa kwa usahihi katika kazi za kikundi.",
            "Milinganyo iliyoundwa na wanafunzi wenzao imewekwa kwa usahihi na kuhesabiwa kwa usahihi.",
            "Maswali ya kujiondoa yamekamilishwa kwa usahihi kuonyesha umilisi wa dhana.",
        ]
        resources = [f"Kitabu cha somo cha {subject_label} (TIE)", "Ramani / michoro"]
        references = ["Misingumo ya TIE (Tanzania Institute of Education)"]
        environment = "Mpangilio wa makundi ya ushirikiano na vifaa vya kujifunzia vinavyofikiwa kwa urahisi"
        main_comp = f"Kuonyesha ustadi wa lugha ya hisabati na dhana za {topic}"
        spec_comp = f"Kutumia misemo ya aljebra na {subtopic_display} katika miktadha mbalimbali"
        main_act = f"Kuunda na kutatua {subtopic_display} kutokana na matatizo halisi ya maisha."
        spec_act = f"Fafanua dhana kuu za {subtopic_display} na kuzitumia katika miktadha halisi"
        fields = {
            "phase": "Hatua", "time": "Muda", "teacher_act": "Shughuli ya Mwalimu",
            "student_act": "Shughuli ya Mwanafunzi", "competency": "Ujuzi mkuu wa Karne ya 21",
            "assessment": "Kigezo cha Tathmini",
        }
    else:
        stage_names = [
            "Introduction",
            "Competence Development",
            "Design",
            "Realizations",
        ]
        teacher_acts = [
            "Displays word cards with simple arithmetic scenarios and prompts students to identify the unknown values using letters/variables.",
            f"Guides students in small groups to read given word scenarios on {subtopic_display}, form algebraic statements, and solve step-by-step on flip charts.",
            "Assigns individual contextual math problems and asks students to formulate their own word problems to exchange with a peer.",
            f"Guides students to summarise key rules of {subtopic_display}, provides exit ticket questions, and assigns homework exercises.",
        ]
        learner_acts = [
            "Observe the word cards, answer oral questions, and identify unknown quantities represented by variables.",
            "In small groups, discuss scenario cards, convert words into equations, and calculate the value of the unknown variable.",
            "Formulate individual word problems, exchange exercise books with peers, and solve peer-generated equations.",
            "State key learnings, complete exit ticket questions individually, and write down assigned homework.",
        ]
        assessment = [
            "Students identify unknown variables correctly from given statements.",
            "Equations correctly formulated and solved in group tasks.",
            "Peer-generated equations are correctly set up and accurately calculated.",
            "Exit tickets accurately completed showing mastery of the concept.",
        ]
        resources = [
            f"Flashcards with word problems on {topic}",
            "Realia (coins/market items)",
            f"Chart illustrating steps of {subtopic_display}",
            "Mathematics exercise books",
        ]
        references = [
            f"Tanzania Institute of Education (TIE). (2023). "
            f"Mathematics for Secondary Schools Student's Book {class_name}. "
            "TIE, Dar es Salaam."
        ]
        environment = "Collaborative group layout with accessible learning materials"
        main_comp = "Demonstrate mastery of algebraic concepts and logical reasoning in real-life problem solving"
        spec_comp = "Apply linear equations in one variable to solve everyday contextual problems"
        main_act = "Formulate and solve simple linear equations from contextual word problems"
        spec_act = "Define the key concepts of linear equations and apply them to everyday contextual problems"
        fields = {
            "phase": "Stage / Time", "time": "Time", "teacher_act": "Teacher Activity",
            "student_act": "Learner Activity", "competency": "21st-Century Core Competency",
            "assessment": "Assessment Criteria",
        }

    # Prefer content sourced from the Scheme-of-Work rows (derived from the
    # verbatim TIE syllabus): competence, activities, resources and references
    # all come from the same teaching row the teacher planned. Falls back to
    # the knowledge-base lookup (then the generic scaffolding) when the
    # subject/form has no real scheme data or no row matches the topic/subtopic.
    scheme_row = _scheme_row_for_lesson(subject_slug, form_level, topic, subtopic, lang)
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
        kb_plan = _lookup_lesson_plan_content(
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
    _ground = fetch_reference_grounding(subject_slug, form_level, topic or subtopic, "lesson_plan")
    if _ground and not scheme_row:
        _gl = lesson_plan_grounding(_ground.get("content") or {})
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
    # for this teaching topic, independent of the knowledge-base lookup.
    tie_main, tie_spec = _tie_competences(subject_slug, form_level, topic, lang)
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
            _subj = get_subject_with_form(subject_slug, form_level)
        except Exception:
            _subj = None
        t_code, s_code, _sp = _build_lesson_plan_topic_codes(_subj, topic, subtopic, lang)
        if t_code and not str(main_comp).startswith(str(t_code)):
            main_comp = f"{t_code} {main_comp}"
        if s_code and not str(spec_comp).startswith(str(s_code)):
            spec_comp = f"{s_code} {spec_comp}"

    # TIE assessment criteria echo the specific activity with fixed verb patterns.
    if lang == "sw":
        assessment = [
            f"Wanafunzi hutambua maarifa ya awali yanayohusu {specific_activity}.",
            f"Wanafunzi huonyesha kwa usahihi uelewa wa {specific_activity}.",
            f"Wanafunzi hutumia kwa usahihi dhana na ujuzi unaohusu {specific_activity}.",
            f"Wanafunzi wanathibitisha kwa imani matokeo yanayohusu {specific_activity}.",
        ]
    else:
        assessment = [
            f"Students identify prior knowledge related to {specific_activity}.",
            f"Students accurately demonstrate understanding of {specific_activity}.",
            f"Students correctly apply concepts and skills related to {specific_activity}.",
            f"Students confidently justify outcomes related to {specific_activity}.",
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
            "lesson_objective": (
                f"By the end of this {duration_minutes}-minute lesson, "
                f"the learner should be able to demonstrate {specific_activity}"
                if lang == "en"
                else
                f"Mwisho wa somo hili la dakika {duration_minutes}, "
                f"mwanafunzi anapaswa kuwa na uwezo wa kuonyesha {specific_activity}"
            ),
        },
        "resources_strategies": {
            "teaching_learning_resources": resources,
            "references": references,
            "learning_environment": environment,
        },
        "progression_matrix": progression,
        "fields": fields,
        "evaluation_learners": (
            f"By the end of the {duration_minutes}-minute lesson on {specific_activity}, "
            f"the teacher observes the {total} registered learners ({boys} boys, {girls} "
            f"girls). Learners demonstrate mastery of {specific_activity} through group "
            "tasks, oral questioning and exit-ticket responses; approximately 80% are "
            "expected to meet the specific competence, with remediation planned for those "
            "who require reinforcement."
            if lang == "en"
            else
            f"Mwisho wa somo la dakika {duration_minutes} kuhusu {specific_activity}, "
            f"mwalimu huwachunguza wanafunzi {total} walioandikishwa ({boys} wavulana, "
            f"{girls} wasichana). Wanafunzi huonyesha umilisi wa {specific_activity} "
            "kupitia kazi za vikundi, maswali ya mdomo na majibu ya mwisho wa somo; "
            "takriban 80% wanatarajiwa kufikia ujuzi mahususi, na marekebisho "
            "yatafanywa kwa wanaohitaji kuimarishwa."
        ),
        "evaluation_teacher": (
            f"Self-reflection: the teacher of {subject_label} for the lesson {specific_activity} "
            f"will note the effectiveness of the planned methods and resources in advancing "
            f"learners toward the specific competence. Any stage that required more than its "
            f"allocated time (per the {duration_minutes}-minute progression) is recorded so "
            "the plan can be adjusted for the next lesson."
            if lang == "en"
            else
            f"Kujitathmini: mwalimu wa {subject_label} kwa somo {specific_activity} "
            f"ataandika ufanisi wa mbinu na rasilimali zilizopangwa katika kuwaendeleza "
            f"wanafunzi kuelekea ujuzi mahususi. Hatua yoyote iliyochukua muda zaidi ya "
            f"iliyopangwa (kwa muda wa dakika {duration_minutes}) itarekodiwa ili "
            "mpango urekebishwe kwa somo lijalo."
        ),
        "remarks": (
            f"Record here the proportion of the {total} learners who achieved the specific "
            f"competence on {specific_activity}, the effectiveness of the teaching methods "
            "and resources, and any required remediation for the next lesson."
            if lang == "en"
            else
            f"Andika hapa asilimia ya wanafunzi {total} waliofikia ujuzi mahususi wa "
            f"{specific_activity}, ufanisi wa mbinu na rasilimali za kufundisha, "
            "na marekebisho yanayohitajika kwa somo lijalo."
        ),
    }


def _midterm_weeks(lang: str) -> list[dict]:
    """Two non-teaching scheme weeks inserted at each term's midpoint: the
    midterm examination and the midterm holiday (per official TIE schemes).
    periods=0 so they never alter the teaching-period total (which must equal
    the sum of subtopic periods)."""
    if lang == "sw":
        return [
            {
                "topic": "MTIHANI WA MUHULA",
                "subtopic": "Mtihani wa Muhula",
                "main_competence": "MTIHANI WA MUHULA",
                "specific_competence": "Kutathmini umahiri wa wanafunzi katika mada za muhula",
                "learning_activities": [
                    "Kufanya mtihani wa muhula",
                    "Kukagua majaribio na kujadili maendeleo ya wanafunzi",
                ],
                "specific_activities": "Mtihani wa kati wa muhula",
                "periods": 0,
                "reference": "TIE Syllabus",
                "teaching_methods": ["Mtihani wa mdomo", "Mtihani wa maandishi"],
                "teaching_resources": ["Karatasi za mitihani", "Vielelezo"],
                "assessment_tools": "Mtihani wa muhula",
                "remarks": "Andika maelezo ya utendaji wa wanafunzi",
                "teaching_aids": ["Kitabu", "Karatasi za mitihani"],
                "competences": ["MTIHANI WA MUHULA"],
                "objectives": ["Kufanya mtihani wa muhula"],
                "references": ["TIE Syllabus"],
                "assessment": "Mtihani wa muhula",
            },
            {
                "topic": "LIKIZO LA MUHULA",
                "subtopic": "Likizo ya Muhula",
                "main_competence": "LIKIZO LA MUHULA",
                "specific_competence": "Mapumziko ya wanafunzi kutokana na mtihani wa muhula",
                "learning_activities": [
                    "Wanafunzi wanapumzika na kufanya masomo ya nje ya darasa",
                ],
                "specific_activities": "Likizo ya kati ya muhula",
                "periods": 0,
                "reference": "TIE Syllabus",
                "teaching_methods": ["Kusoma binafsi"],
                "teaching_resources": ["Vitabu vya masomo"],
                "assessment_tools": "Hakuna tathmini rasmi",
                "remarks": "Rudi shuleni kwa muhula wa pili kwa tayari",
                "teaching_aids": ["Vitabu"],
                "competences": ["LIKIZO LA MUHULA"],
                "objectives": ["Likizo ya muhula"],
                "references": ["TIE Syllabus"],
                "assessment": "Hakuna",
            },
        ]
    return [
        {
            "topic": "MIDTERM EXAMINATION",
            "subtopic": "Midterm Examination",
            "main_competence": "MIDTERM EXAMINATION",
            "specific_competence": "Assess learner mastery of the Term's topics",
            "learning_activities": [
                "Sit for the midterm examination",
                "Review tests and discuss learner progress",
            ],
            "specific_activities": "Midterm assessment",
            "periods": 0,
            "reference": "TIE Syllabus",
            "teaching_methods": ["Oral assessment", "Written examination"],
            "teaching_resources": ["Examination papers", "Marking guides"],
            "assessment_tools": "Midterm examination",
            "remarks": "Record learner performance and plan remediation",
            "teaching_aids": ["Textbook", "Examination papers"],
            "competences": ["MIDTERM EXAMINATION"],
            "objectives": ["Sit for the midterm examination"],
            "references": ["TIE Syllabus"],
            "assessment": "Midterm examination",
        },
        {
            "topic": "MIDTERM HOLIDAY",
            "subtopic": "Midterm Holiday",
            "main_competence": "MIDTERM HOLIDAY",
            "specific_competence": "Learner break following the midterm examination",
            "learning_activities": [
                "Learners rest and undertake self-study during the break",
            ],
            "specific_activities": "Midterm break",
            "periods": 0,
            "reference": "TIE Syllabus",
            "teaching_methods": ["Independent study"],
            "teaching_resources": ["Learner books"],
            "assessment_tools": "No formal assessment",
            "remarks": "Resume refreshed for the second half of the term",
            "teaching_aids": ["Books"],
            "competences": ["MIDTERM HOLIDAY"],
            "objectives": ["Midterm holiday"],
            "references": ["TIE Syllabus"],
            "assessment": "None",
        },
    ]


def _distribute_periods(activities: list[str], total: int) -> list[dict]:
    """Distribute *total* periods across *activities* as evenly as possible.

    Returns a list of ``{"activity": str, "periods": int}`` dicts whose
    period values sum to exactly *total*.  When *activities* is empty a
    single placeholder row is returned.
    """
    if not activities:
        return [{"activity": "", "periods": total}]
    n = len(activities)
    if total <= 0:
        return [{"activity": a, "periods": 0} for a in activities]
    base = total // n
    extra = total - base * n          # first *extra* activities get +1
    return [
        {"activity": a, "periods": base + (1 if i < extra else 0)}
        for i, a in enumerate(activities)
    ]


_ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
          "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii"]


def _num(marker: int) -> str:
    return _ROMAN[marker] if 0 <= marker < len(_ROMAN) else str(marker + 1)


def _derive_specific_activities(activity_text: str) -> list[str]:
    """Break a syllabus learning activity into numbered (i)/(ii)/(iii) items.

    Prefers an explicit ``(i) (ii) ...`` list, then a trailing parenthetical
    of sub-topics, then sentence/clause boundaries, and finally a single item.
    """
    text = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", (activity_text or "").strip())
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # 1. Already a numbered (i)/(ii)/... list
    if re.search(r"\(\s*i\s*\)", text, re.I):
        parts = re.split(r"(?i)\s*\(\s*(?=[ivxlc\d]+\))", text)
        parts = [p.strip().strip(".;,() \t") for p in parts if p.strip()]
        if len(parts) >= 2:
            return parts

    # 2. Trailing parenthetical list of sub-topics
    m = re.search(r"\(([^()]*)\)\s*[.;]?\s*$", text)
    if m:
        inner = m.group(1)
        items = [s.strip() for s in re.split(r";|\u2014|,", inner) if s.strip()]
        if len(items) >= 2:
            cleaned = []
            for it in items:
                it = re.sub(r"^\s*(?:and|or|&)\s+", "", it).strip()
                it = re.sub(r"\s+(?:and|or)\s*$", "", it).strip()
                if it:
                    cleaned.append(f"({_num(len(cleaned))}) {it[:1].upper()}{it[1:]}")
            if cleaned:
                return cleaned

    # 3. Sentence / clause split
    clauses = [c for c in re.split(r"(?<=[.;:])\s+", text) if c.strip()]
    if len(clauses) >= 2:
        return [f"({_num(i)}) {c.strip().strip('.;')}".strip() for i, c in enumerate(clauses)]

    # 4. Single item
    return [f"(i) {text}"]


def _split_periods_total(total: int, n: int) -> list[int]:
    """Split a specific competence's total periods across *n* rows."""
    if n <= 0:
        return []
    if total <= 0:
        return [4] * n
    base = total // n
    extra = total - base * n
    return [base + (1 if i < extra else 0) for i in range(n)]


def _e_list_item(items, idx, default=""):
    """Return the *idx*-th item of a list, a joined string, or default."""
    if not items:
        return default
    if isinstance(items, str):
        return items if idx == 0 else default
    try:
        frac = idx / len(items)
    except ZeroDivisionError:
        return default
    if isinstance(items[0], str):
        return items[idx] if idx < len(items) else default
    return default


def _sample_book_reference(subject_label: str, form_level: int, lang: str,
                           year: str = "2024") -> str:
    if lang == "sw":
        return (f"T.I.E. ({year}). Kitabu cha Wanafunzi cha {subject_label}, "
                f"Kidato cha {form_level}. Dar es Salaam.")
    return (f"T.I.E. ({year}). {subject_label} Students Book "
            f"Form {form_level}. Dar es Salaam.")


def _strip_item_marker(text: str) -> str:
    """Remove a leading '(i)' / '(1)' item marker from a specific activity."""
    return re.sub(r"^\s*\(\s*[ivxlc\d]+\s*\)\s*", "", (text or "")).strip()


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

    # Preferred source: the verbatim TIE CBC (2023) syllabus dataset. Each
    # Specific Competence is expanded into one scheme row per learning
    # activity, with the activity's (i)/(ii)/(iii) sub-parts as the row's
    # "Specific activities" and the competence's total periods split across
    # those rows.
    try:
        specs = ts_get_specific_competences(subject_slug, form_level)
    except Exception:
        specs = []

    if specs:
        # If specific topics were requested, keep only the competences that
        # best match them; otherwise include the full form syllabus.
        if topics:
            kept = []
            for t in topics or []:
                rec = ts_find_by_keyword(subject_slug, form_level, t)
                if rec and rec not in kept:
                    kept.append(rec)
            specs = kept or specs

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
                teaching_rows.append({
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

    # Fallback: pull syllabus structure from the knowledge base (topics -> subtopics).
    if not teaching_rows:
        rows = []
        try:
            subject_data = get_subject_with_form(subject_slug, form_level)
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
        _sow = fetch_reference_grounding(subject_slug, form_level, None, "scheme_of_work")
        _sow_box = scheme_of_work_grounding((_sow or {}).get("content") or {}) if _sow else {}
        for row in rows:
            topic_title = row["topic"]
            topic_code = row["topic_code"]
            subs = row["subtopics"]
            if not subs:
                # One week per topic when no subtopic breakdown is available.
                subtopic_list = [{
                    "title": (f"Part {len(teaching_rows) + 1}" if lang == "en" else f"Sehemu ya {len(teaching_rows) + 1}"),
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
                teaching_rows.append(week_row)

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


def _subject_book(subject_label: str, class_name: str, lang: str) -> str:
    if lang == "sw":
        return f"Kitabu cha somo cha {subject_label} Standard {class_name}, Dar es Salaam"
    return f"{subject_label} Students Book for {class_name}, Dar es Salaam"


# ── HTML Rendering ─────────────────────────────────────────────────────────

def render_lesson_plan_html(plan: dict) -> str:
    plan = _fill_lesson_plan_placeholders(
        plan,
        topic_code="",
        topic_title=str(plan.get("header", {}).get("topic", "")),
        sub_code="",
        sub_title=str(plan.get("header", {}).get("subtopic", "")),
        duration_minutes=int(plan.get("header", {}).get("duration_minutes") or 40),
    )
    h = plan.get("header", {})
    is_sw = any(
        w in (h.get("topic", "") + h.get("subject", "")).lower()
        for w in ["historia", "maadili", "kiswahili", "uraia"]
    )

    LST = lambda en, sw: sw if is_sw else en
    _school = LST("School Name", "Jina la Shule")
    _teacher = LST("Teacher's Name", "Jina la Mwalimu")
    _class = LST("Class/Form", "Darasa/Kidato")
    _subject = LST("Subject", "Somo")
    _date = LST("Date", "Tarehe")
    _time = LST("Time", "Muda")
    _students = LST("NUMBER OF STUDENTS", "IDADI YA WANAFUNZI")
    _registered = LST("REGISTERED", "WALIOANDIKISHWA")
    _present = LST("PRESENT", "WALIOHUDHURIA")
    _boys = LST("BOYS", "WAVULANA")
    _girls = LST("GIRLS", "WASICHANA")
    _total = LST("TOTAL", "JUMLA")
    _main_comp = LST("2. MAIN COMPETENCE", "2. UJUZI MKUU")
    _specific_comp = LST("3. SPECIFIC COMPETENCE", "3. UJUZI MAHUSUSI")
    _main_act = LST("4. MAIN ACTIVITY", "4. SHUGHULI KUU")
    _specific_act = LST("5. SPECIFIC ACTIVITY", "5. SHUGHULI MAHUSUSI")
    _tlr = LST("6. TEACHING/LEARNING RESOURCE", "6. RASILIMALI ZA KUFUNDISHA/KUJIFUNZA")
    _references = LST("REFERENCES:", "MAREJEO:")
    _stages = LST("Stage", "Hatua")
    _time_min = LST("Time", "Muda")
    _teaching_act = LST("Teacher's Activities", "Shughuli za Mwalimu")
    _learning_act = LST("Learners' Activities", "Shughuli za Wanafunzi")
    _assessment = LST("Assessment Criteria", "Kigezo cha Tathmini")
    _absent = LST("ABSENT", "WALIOKUWA HAWAPO")
    _teacher_eval = LST("Teacher's Evaluation / Self-Reflection", "Tathmini ya Mwalimu / Kujitathmini")
    _teacher_eval_hint = LST(
        "(Indicate the percentage of students who achieved the specific competence, effectiveness of teaching methods/resources, and required remediation.)",
        "(Onyesha asilimia ya wanafunzi waliofikia ujuzi mahususi, ufanisi wa mbinu/rasilimali za kufundisha, na marekebisho yanayohitajika.)",
    )
    _signature = LST("Signature", "Sahihi")

    sreg = h.get("students_registered", {}) or {}
    spres = h.get("students_present", {}) or {}
    sabse = h.get("students_absent", {}) or {}
    ca = plan.get("competence_architecture", {}) or {}
    rs = plan.get("resources_strategies", {}) or {}
    matrix = plan.get("progression_matrix", []) or []
    activities = plan.get("teaching_activities", [])

    def _e(s):
        from html import escape
        return escape(str(s))

    def _li(items):
        if not items:
            return ""
        if isinstance(items, str):
            items = [items]
        return " · ".join(str(i) for i in items)

    class_name = h.get("class_name", "")
    # Convert "Form 2" → "Form Two" for the TIE label
    _num_words = {"1":"One","2":"Two","3":"Three","4":"Four","5":"Five","6":"Six",
                  "7":"Seven","8":"Eight","9":"Nine","10":"Ten"}
    if class_name.startswith("Form ") and class_name.split()[-1] in _num_words:
        class_name = "Form " + _num_words[class_name.split()[-1]]
    subject = h.get("subject", "")
    school_name = _e(h.get("school_name", ""))
    teacher_name = _e(h.get("teacher_name", ""))
    date = _e(h.get("date", ""))
    time_from = h.get("time_from", "")
    time_to = h.get("time_to", "")
    # Convert 24h to 12h AM/PM (e.g. "08:00" → "08:00 AM")
    def _ampm(t: str) -> str:
        try:
            parts = t.split(":")
            h24 = int(parts[0])
            m = parts[1]
            suffix = "AM" if h24 < 12 else "PM"
            h12 = h24 % 12 or 12
            return f"{h12}:{m} {suffix}"
        except Exception:
            return t
    time_from_fmt = _ampm(time_from)
    time_to_fmt = _ampm(time_to)
    duration = int(h.get("duration_minutes") or 40)
    number_total = sreg.get("total", h.get("number_of_students", ""))
    tp = _e(h.get("topic", ""))

    # ── Stage rows (TIE 4 stages or fallback) ─────────────────────────────
    stages_rows = ""
    if matrix:
        for idx, a in enumerate(matrix, start=1):
            stages_rows += f"""<tr>
                <td class="bold">{_e(a.get('stage', ''))}</td>
                <td class="text-center">{_e(str(a.get('time')).split()[0])}</td>
                <td>{_e(a.get('teacher_activity', ''))}</td>
                <td>{_e(a.get('learner_activity', a.get('student_activity', '')))}</td>
                <td>{_e(a.get('assessment_criteria', ''))}</td>
            </tr>"""
    else:
        for idx, a in enumerate(activities, start=1):
            stages_rows += f"""<tr>
                <td class="bold">{idx}. {_e(a.get('phase', ''))}</td>
                <td class="text-center">{_e(str(a.get('time', '')).split()[0])}</td>
                <td>{_e(a.get('teacher_activity', ''))}</td>
                <td>{_e(a.get('student_activity', ''))}</td>
                <td>{_e(a.get('remarks_assessment', ''))}</td>
            </tr>"""

    # ── Competence & resources sections ───────────────────────────────────
    comp_sections = ""
    mc = ca.get("main_competence", "")
    sc = ca.get("specific_competence", "")
    ma = ca.get("main_learning_activity", ca.get("main_activity", ""))
    sa = ca.get("specific_learning_activity", ca.get("specific_activity", ""))
    tlr_val = rs.get("teaching_learning_resources") or plan.get("teaching_aids", [])
    if not tlr_val:
        tlr_val = plan.get("teaching_aids", [])
    refs = rs.get("references", plan.get("references", []))
    if mc:
        comp_sections += f'<div class="sec"><div class="sec-title">{_e(_main_comp)}</div><div class="sec-body">{_e(mc)}</div></div>'
    if sc:
        comp_sections += f'<div class="sec"><div class="sec-title">{_e(_specific_comp)}</div><div class="sec-body">{_e(sc)}</div></div>'
    if ma:
        comp_sections += f'<div class="sec"><div class="sec-title">{_e(_main_act)}</div><div class="sec-body">{_e(ma)}</div></div>'
    if sa:
        comp_sections += f'<div class="sec"><div class="sec-title">{_e(_specific_act)}</div><div class="sec-body">{_e(sa)}</div></div>'
    if tlr_val:
        comp_sections += f'<div class="sec"><div class="sec-title">{_e(_tlr)}</div><div class="sec-body">{_e(_li(tlr_val))}</div>'
        if refs:
            comp_sections += f'<div class="refs"><strong>{_e(_references)}</strong> {_e(_li(refs))}</div>'
        comp_sections += "</div>"
    elif refs:
        comp_sections += f'<div class="sec"><div class="sec-body"><strong>{_e(_references)}</strong> {_e(_li(refs))}</div></div>'

    return f"""<!DOCTYPE html>
<html lang="{'sw' if is_sw else 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Official TIE CBC Lesson Plan Format - Tanzania</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 24px;
            color: #1e293b;
            background-color: #f8fafc;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }}
        .lesson-container {{
            max-width: 960px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 32px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
        }}
        .header {{
            text-align: center;
            font-weight: 700;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e2e8f0;
        }}
        .header h2, .header h3, .header h4 {{
            margin: 4px 0;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }}
        .header h2 {{ font-size: 15pt; color: #0f172a; }}
        .header h3 {{ font-size: 13pt; color: #334155; font-weight: 600; }}
        .header h4 {{ font-size: 12pt; color: #475569; font-weight: 500; text-decoration: none; border-bottom: 1px dashed #cbd5e1; display: inline-block; padding-bottom: 2px; }}
        .header .title-line {{ font-size: 12pt; text-transform: uppercase; letter-spacing: 0.03em; color: #334155; }}

        /* Info table: auto-colwidths so cells stretch equally */
        .info-table {{ table-layout: auto; }}
        .info-table td {{ padding: 7px 10px; }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }}
        th, td {{
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            font-size: 10pt;
            vertical-align: top;
            line-height: 1.45;
        }}
        th {{
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
        }}
        .bg-head {{
            background-color: #f1f5f9;
            font-weight: 600;
            text-align: center;
            color: #334155;
            font-size: 9.5pt;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }}
        .text-center {{ text-align: center; }}
        .bold {{ font-weight: 600; color: #0f172a; }}
        .sec {{
            margin-bottom: 16px;
        }}
        .sec-title {{
            font-weight: 700;
            margin: 18px 0 6px 0;
            font-size: 10.5pt;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding-bottom: 4px;
            border-bottom: 2px solid #dbeafe;
        }}
        .sec-body {{
            margin-left: 14px;
            color: #334155;
            line-height: 1.5;
        }}
        .refs {{
            margin: 6px 0 0 14px;
            font-style: italic;
            color: #64748b;
            font-size: 9.5pt;
        }}

        /* ── Wide tables: horizontal scroll on small screens ─────── */
        .table-wrap {{
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin-bottom: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }}
        .table-wrap table {{
            margin-bottom: 0;
            min-width: 600px;
        }}

        @media print {{
            body {{ margin: 0; background: #fff; }}
            .lesson-container {{ border: none; padding: 0; box-shadow: none; border-radius: 0; }}
            .no-print {{ display: none; }}
            .table-wrap {{ overflow: visible; border: none; border-radius: 0; }}
            .table-wrap table {{ min-width: 0; }}
        }}

        /* ── Small screens ──────────────────────────────────────── */
        @media (max-width: 640px) {{
            body {{ margin: 10px; }}
            .lesson-container {{ padding: 16px; border-radius: 8px; }}
            .info-table td {{
                display: block;
                width: 100% !important;
                padding: 5px 8px;
                font-size: 9pt;
                border-bottom: 1px solid #f1f5f9;
            }}
            .info-table tr td:last-child {{ border-bottom: none; }}
            th, td {{
                padding: 5px 6px;
                font-size: 8.5pt;
            }}
            .bg-head {{ font-size: 8pt; }}
            .sec-title {{ font-size: 9.5pt; margin: 14px 0 4px 0; }}
            .sec-body {{ margin-left: 8px; font-size: 9pt; }}
        }}
    </style>
</head>
<body>

<div class="lesson-container">
    <table class="info-table">
        <tr>
            <td><strong style="color:#1e40af;font-size:9pt">LESSON PLAN NO.</strong> ______</td>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_date)}</strong> . . . . . . . . . . . . . . . . . . . .</td>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_time)}</strong> . . . . . . . . . . . . . . . . . . . .</td>
        </tr>
        {school_name and f'''<tr>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_school)}:</strong> {school_name}</td>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_teacher)}:</strong> {teacher_name}</td>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_class)}:</strong> {_e(class_name)}</td>
        </tr>'''}
        <tr>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(_subject)}:</strong> {_e(subject)}</td>
            <td><strong style="color:#1e40af;font-size:9pt">{_e(LST('Specific competence', 'Ujuzi mahususi'))}:</strong> {_e(sc or tp)}</td>
            <td></td>
        </tr>
    </table>

    <div class="sec-title">1. CLASS INFORMATION</div>
    <div class="table-wrap">
    <table>
        <tr class="bg-head">
            <td rowspan="2" style="vertical-align: middle; width: 20%;">{_e(_students)}</td>
            <td colspan="3">{_e(_registered)}</td>
            <td colspan="3">{_e(_present)}</td>
            <td colspan="3">{_e(_absent)}</td>
        </tr>
        <tr class="bg-head">
            <td style="width: 11%;">{_e(_girls)}</td>
            <td style="width: 11%;">{_e(_boys)}</td>
            <td style="width: 11%;">{_e(_total)}</td>
            <td style="width: 11%;">{_e(_girls)}</td>
            <td style="width: 11%;">{_e(_boys)}</td>
            <td style="width: 11%;">{_e(_total)}</td>
            <td style="width: 11%;">{_e(_girls)}</td>
            <td style="width: 11%;">{_e(_boys)}</td>
            <td style="width: 12%;">{_e(_total)}</td>
        </tr>
        <tr class="text-center">
            <td class="bold">{_e(LST('Number', 'Idadi'))}</td>
            <td>{_e(sreg.get('girls', '') or '.')}</td>
            <td>{_e(sreg.get('boys', '') or '.')}</td>
            <td>{_e(sreg.get('total', '') or '.')}</td>
            <td>{_e(spres.get('girls', '') or '.')}</td>
            <td>{_e(spres.get('boys', '') or '.')}</td>
            <td>{_e(spres.get('total', '') or '.')}</td>
            <td>{_e(sabse.get('girls', '') or '.')}</td>
            <td>{_e(sabse.get('boys', '') or '.')}</td>
            <td>{_e(sabse.get('total', '') or '.')}</td>
        </tr>
    </table>
    </div>

    {comp_sections}

    <div class="sec-title">TEACHING AND LEARNING PROCESS</div>
    <div class="table-wrap">
    <table>
        <thead>
            <tr class="bg-head">
                <td style="width: 15%;">{_e(_stages)}</td>
                <td style="width: 10%;">{_e(_time_min)}</td>
                <td style="width: 30%;">{_e(_teaching_act)}</td>
                <td style="width: 30%;">{_e(_learning_act)}</td>
                <td style="width: 15%;">{_e(_assessment)}</td>
            </tr>
        </thead>
        <tbody>
        {stages_rows}
        </tbody>
    </table>
    </div>

    <div class="sec-title">REMARKS</div>
    <div class="sec" style="margin-bottom:10px">
        <div class="no-print" style="font-size:9pt;color:#64748b;margin-bottom:4px;font-style:italic">{_e(_teacher_eval_hint)}</div>
        <div style="min-height:48px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc;font-size:9pt">{_e(plan.get('remarks', ''))}</div>
    </div>

    <div style="display:flex;justify-content:flex-end;align-items:center;gap:24px;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0">
        <div style="text-align:center">
            <div style="min-width:140px;border-bottom:1px solid #94a3b8;margin-bottom:4px">&nbsp;</div>
            <div style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.04em">{_e(_signature)}</div>
        </div>
        <div style="text-align:center">
            <div style="min-width:140px;border-bottom:1px solid #94a3b8;margin-bottom:4px">&nbsp;</div>
            <div style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.04em">{_e(_date)}</div>
        </div>
    </div>
</div>

</body>
</html>"""
def render_scheme_of_work_html(plan: dict) -> str:
    h = plan.get("header", {})
    weeks = plan.get("weeks", [])
    is_sw = any(
        w in (h.get("subject", "") + h.get("term", "")).lower()
        for w in ["historia", "maadili", "kiswahili", "uraia"]
    )

    labels = {
        "school": "School Name" if not is_sw else "Jina la Shule",
        "teacher": "Teacher" if not is_sw else "Mwalimu",
        "subject": "Subject" if not is_sw else "Somo",
        "class": "Class" if not is_sw else "Darasa",
        "term": "Term" if not is_sw else "Muhtasari",
        "year": "Academic Year" if not is_sw else "Mwaka wa Masomo",
        "main_comp": "Main competence" if not is_sw else "Ujuzi Mkuu",
        "spec_comp": "Specific competence" if not is_sw else "Ujuzi Mahususi",
        "learn_act": "Learning Activities" if not is_sw else "Shughuli za Kujifunza",
        "spec_act": "Specific activities" if not is_sw else "Shughuli Mahususi",
        "month": "Month" if not is_sw else "Mwezi",
        "wk": "Week" if not is_sw else "Wiki",
        "periods": "Periods" if not is_sw else "Vipindi",
        "reference": "Reference" if not is_sw else "Marejeo",
        "methods": "Teaching and learning methods" if not is_sw else "Mbinu za Kufundisha na Kujifunza",
        "resources": "Teaching and learning resources" if not is_sw else "Rasilimali za Kufundisha na Kujifunza",
        "assess": "Assessment tools" if not is_sw else "Zana za Tathmini",
        "rem": "Remarks" if not is_sw else "Maelezo",
    }

    def _e(s):
        from html import escape
        return escape(str(s))

    def _li(items):
        if not items:
            return ""
        if isinstance(items, str):
            items = [items]
        return ", ".join(_e(str(i)) for i in items)

    rows = ""
    for w in weeks:
        main_comp = _e(w.get('main_competence') or w.get('competences', w.get('topic', '')))
        if isinstance(w.get('main_competence'), list):
            main_comp = _li(w.get('main_competence'))
        spec_comp = _e(w.get('specific_competence',''))
        if isinstance(w.get('specific_competence'), list):
            spec_comp = _li(w.get('specific_competence'))
        learn_act = _e(w.get('learning_activities') or w.get('objectives', ''))
        schedule = w.get('learning_activity_schedule')
        if schedule:
            learn_act = ", ".join(
                f"{_e(s['activity'])} ({s['periods']} {'period' if s['periods'] == 1 else 'periods'})"
                for s in schedule if s.get('activity')
            ) or learn_act
        elif isinstance(w.get('learning_activities'), list):
            learn_act = _li(w.get('learning_activities'))
        spec_act = _e(w.get('specific_activities') or w.get('subtopic', ''))
        if isinstance(w.get('specific_activities'), list):
            spec_act = _li(w.get('specific_activities'))
        month = _e(w.get('month', ''))
        week = _e(w.get('week') or w.get('week_number', ''))
        periods = _e(w.get('periods', ''))
        reference = _e(w.get('reference') or _li(w.get('references', [])))
        methods = _li(w.get('teaching_methods', [])) or _e(w.get('methods', ''))
        resources = _li(w.get('teaching_resources', w.get('teaching_aids', [])))
        assess = _e(w.get('assessment_tools') or w.get('assessment', ''))
        remarks = _e(w.get('remarks', ''))
        rows += f"""<tr>
            <td>{main_comp}</td>
            <td>{spec_comp}</td>
            <td>{learn_act}</td>
            <td>{spec_act}</td>
            <td style="text-align:center">{month}</td>
            <td style="text-align:center">{week}</td>
            <td style="text-align:center">{periods}</td>
            <td>{reference}</td>
            <td>{methods}</td>
            <td>{resources}</td>
            <td>{assess}</td>
            <td>{remarks}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="{'sw' if is_sw else 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_e(h.get('subject', 'Scheme of Work'))}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @media print {{
    body {{ margin: 0.3cm; font-size: 8.5pt; }}
    .no-print {{ display: none !important; }}
    @page {{ margin: 0.5cm; size: A4 landscape; }}
    div[style*="overflow-x"] {{ overflow: visible; border: none; border-radius: 0; }}
    div[style*="overflow-x"] table {{ min-width: 0; }}
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    padding: 20px;
    -webkit-font-smoothing: antialiased;
  }}
  .title-block {{
    text-align: center;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #eff6ff, #f0fdf4);
  }}
  .title-block h1 {{
    font-size: 15pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 800;
    color: #0f172a;
  }}
  .meta-row {{
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    margin-bottom: 16px;
    padding: 8px 0;
    border-bottom: 2px solid #e2e8f0;
    flex-wrap: wrap;
    gap: 4px 24px;
  }}
  .meta-row span {{ white-space: nowrap; color: #475569; }}
  .meta-row strong {{ font-weight: 600; color: #1e40af; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    table-layout: fixed;
  }}
  th, td {{
    border: 1px solid #e2e8f0;
    padding: 5px 6px;
    text-align: left;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
    line-height: 1.4;
  }}
  th {{
    background: linear-gradient(135deg, #f1f5f9, #e8f0fe);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7.5pt;
    text-align: center;
    color: #334155;
    letter-spacing: 0.04em;
  }}
  thead {{ display: table-header-group; }}
  tbody tr {{ page-break-inside: avoid; }}
  tbody tr:nth-child(even) {{ background: #f8fafc; }}
  tbody tr:hover {{ background: #f1f5f9; }}
  td.c {{ text-align: center; }}
  .actions {{ text-align: center; margin: 16px 0; }}
  .actions button {{
    padding: 8px 20px;
    margin: 0 6px;
    cursor: pointer;
    font-size: 10pt;
    font-weight: 600;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #334155;
    transition: all 0.15s;
    font-family: inherit;
  }}
  .actions button:hover {{ background: #f1f5f9; border-color: #cbd5e1; }}
  .course-banner {{
    border: 1px solid #e2e8f0;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    font-weight: 700;
    text-align: left;
    padding: 8px 10px;
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1e40af;
    background: #f8fafc;
  }}
  @media (max-width: 640px) {{
    body {{ margin: 10px; padding: 10px; }}
    .title-block {{ padding: 12px; border-radius: 8px; }}
    .title-block h1 {{ font-size: 12pt; }}
    .meta-row {{ font-size: 8.5pt; gap: 2px 12px; padding: 6px 0; }}
    th, td {{ padding: 3px 4px; font-size: 7.5pt; }}
    th {{ font-size: 7pt; }}
    .actions button {{ font-size: 9pt; padding: 6px 14px; }}
  }}
</style>
</head>
<body>
<div class="actions no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <button onclick="downloadAsWord()">Download as Word</button>
</div>

<div class="title-block">
  <h1>{labels['subject']} — {labels['term']}: {_e(h.get('term', ''))} {_e(h.get('academic_year', ''))}</h1>
</div>

<div class="meta-row">
  <span><strong>{labels['school']}:</strong> {_e(h.get('school_name', ''))}</span>
  <span><strong>{labels['teacher']}:</strong> {_e(h.get('teacher_name', ''))}</span>
  <span><strong>{labels['subject']}:</strong> {_e(h.get('subject', ''))}</span>
  <span><strong>{labels['class']}:</strong> {_e(h.get('class_name', ''))}</span>
  <span><strong>{labels['term']}:</strong> {_e(h.get('term', ''))}</span>
  <span><strong>{labels['year']}:</strong> {_e(h.get('academic_year', ''))}</span>
</div>

<div class="course-banner">
  <strong>{_e(h.get('class_name', ''))} ORIENTATION COURSE</strong>
</div>

<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px">
<table>
<thead>
<tr>
  <th style="width:9%">{labels['main_comp']}</th>
  <th style="width:9%">{labels['spec_comp']}</th>
  <th style="width:10%">{labels['learn_act']}</th>
  <th style="width:9%">{labels['spec_act']}</th>
  <th style="width:6%">{labels['month']}</th>
  <th style="width:5%">{labels['wk']}</th>
  <th style="width:5%">{labels['periods']}</th>
  <th style="width:10%">{labels['reference']}</th>
  <th style="width:12%">{labels['methods']}</th>
  <th style="width:11%">{labels['resources']}</th>
  <th style="width:9%">{labels['assess']}</th>
  <th style="width:5%">{labels['rem']}</th>
</tr>
</thead>
<tbody>{rows}</tbody>
</table>
</div>

<script>
function downloadAsWord() {{
  var html = document.documentElement.outerHTML;
  var blob = new Blob(
    ['<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>body {{ font-family: "Inter", "Segoe UI", sans-serif; font-size: 9pt; }} table {{ border-collapse: collapse; }} th, td {{ border: 1px solid #e2e8f0; padding: 3px 4px; }} th {{ background: #f1f5f9; font-weight: 600; }}</style></head><body>' + html + '</body></html>'],
    {{ type: 'application/msword' }}
  );
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'scheme_of_work_' + (document.title || 'document').replace(/[^a-z0-9]/gi, '_') + '.doc';
  a.click();
  URL.revokeObjectURL(url);
}}
</script>
</body>
</html>"""
