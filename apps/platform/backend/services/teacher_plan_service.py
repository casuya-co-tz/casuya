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

from backend.services.ai_service import _call_ai_service
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

    result = await _call_ai_service("/api/tutoring/explain", {
        "question": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
    })

    if result and "response" in result:
        raw = _strip_think_tags(result["response"])
        plan = _parse_plan_json(raw)
        if plan and "header" in plan:
            return plan

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

    result = await _call_ai_service("/api/tutoring/explain", {
        "question": prompt,
        "context": curriculum_ctx,
        "subject_slug": subject_slug,
        "form_level": form_level,
    })

    if result and "response" in result:
        raw = _strip_think_tags(result["response"])
        plan = _parse_plan_json(raw)
        if plan and "header" in plan:
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
            "number_of_students": students_total,
            "students_registered": {"boys": boys, "girls": girls, "total": students_total},
            "students_present": {"boys": "", "girls": "", "total": ""},
        },
        "competence_architecture": {
            "main_competence": "Statement of the overarching competence",
            "specific_competence": "Specific, assessable competence",
            "main_learning_activity": "Broad learning activity for the topic",
            "specific_learning_activity": (
                f"Within {duration_minutes} minutes, learners should be able to ..."
            ),
        },
        "resources_strategies": {
            "teaching_learning_resources": [
                f"{subject_label} TIE Textbook", "Manila charts"
            ],
            "references": ["Tanzania Institute of Education (TIE) Syllabus"],
            "learning_environment": "Collaborative group layout with accessible learning materials",
        },
        "progression_matrix": [
            {"stage": "Introduction", "time": "5 min", "teacher_activity": "...",
             "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Competence Development", "time": "15 min", "teacher_activity": "...",
             "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Design", "time": "12 min", "teacher_activity": "...",
             "learner_activity": "...", "assessment_criteria": "..."},
            {"stage": "Realisation", "time": "8 min", "teacher_activity": "...",
             "learner_activity": "...", "assessment_criteria": "..."},
        ],
        "remarks": "Additional notes",
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
            "kwa HATUA 4 haswa: Utangulizi, Ukuzaji wa Ujuzi, Usanifu, na Utambuzi "
            "(nyakati takriban 5/15/12/8 dakika), kila hatua ikiwa na Shughuli ya "
            "Ufundishaji, Shughuli ya Kujifunza, na Kigezo cha Tathmini.\n"
            "Vifaa vya ufundishaji, marejeo, na mazingira ya kujifunzia lazima vitoke kutoka "
            "kwenye misingumo hapo juu.\n"
            "Kila shughuli lazima iwe na maelezo kamili — si tu majina ya hatua.\n"
            "Umahiri mahususi wa kujifunzia lazima uwe maalum na wenye muda dhahiri "
            f"(ndani ya dakika {duration_minutes}).\n"
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
        "Learning Process with exactly 4 stages: Introduction, Competence Development, "
        "Design, and Realisation (times roughly 5/15/12/8 min), each with a Teaching "
        "Activity, a Learning Activity, and an Assessment Criterion.\n"
        "Teaching & learning resources, references, and the learning environment MUST come "
        "from the curriculum context above.\n"
        "Each stage activity must have FULL descriptions — not just stage names.\n"
        "The specific learning activity must be time-bound and measurable "
        f"(e.g. Within {duration_minutes} minutes, learners should be able to ...).\n"
        f"Language: English"
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
        f"Language: English"
    )


# ── Offline fallback generators ────────────────────────────────────────────


def _build_lesson_plan_offline(
    *, subject_slug, subject_label, form_level, topic, subtopic,
    school_name, teacher_name, number_of_students, students_boys=None, students_girls=None,
    duration_minutes, period, lang,
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
        spec_act = (
            f"Ndani ya dakika {duration_minutes}, wanafunzi wanaweza kutatua "
            f"{subtopic_display} kwa usahihi kupitia mbinu za kusawazisha."
        )
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
            f"Displays word cards with simple arithmetic scenarios and prompts students to identify the unknown values using letters/variables.",
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
        spec_act = (
            f"Within {duration_minutes} minutes, students should be able to formulate "
            "linear equations from real-life scenarios and solve for the unknown variable correctly."
        )
        fields = {
            "phase": "Stage / Time", "time": "Time", "teacher_act": "Teacher Activity",
            "student_act": "Learner Activity", "competency": "21st-Century Core Competency",
            "assessment": "Assessment Criteria",
        }

    progression = []
    for i, label in enumerate(stage_names):
        progression.append({
            "stage": label,
            "time": f"{times[i]} min" if lang != "sw" else f"dakika {times[i]}",
            "teacher_activity": teacher_acts[i],
            "learner_activity": learner_acts[i],
            "assessment_criteria": assessment[i],
        })

    return {
        "header": {
            "school_name": school_name, "teacher_name": teacher_name,
            "class_name": class_name, "subject": subject_label,
            "topic": topic, "subtopic": subtopic_display,
            "date": today, "time_from": "08:00", "time_to": time_to,
            "period": period, "number_of_students": total,
            "students_registered": {"boys": boys, "girls": girls, "total": total},
            "students_present": {"boys": "", "girls": "", "total": ""},
        },
        "competence_architecture": {
            "main_competence": main_comp,
            "specific_competence": spec_comp,
            "main_learning_activity": main_act,
            "specific_learning_activity": spec_act,
        },
        "resources_strategies": {
            "teaching_learning_resources": resources,
            "references": references,
            "learning_environment": environment,
        },
        "progression_matrix": progression,
        "fields": fields,
        "remarks": "",
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
    methods_en = ["Jigsaw puzzle", "Brainstorming", "Problem solving", "Group discussion",
                  "Collaborative learning", "Think-Ink pair-share", "Visual presentations"]
    methods_sw = ["Maswali ya Jigsaw", "Kuchangia mawazo", "Utatuzi wa matatizo", "Mjadala wa kikundi",
                  "Kujifunza kwa ushirikiano", "Jozi za kujadiliana", "Maonyesho ya kuona"]
    months = months_en if lang == "en" else months_sw
    methods = methods_en if lang == "en" else methods_sw

    # Two-term academic year: Term I = Jan-May, Term II = Jul-Nov (4 weeks/month).
    term_months = [0, 1, 2, 3, 4] if "1" in term else [6, 7, 8, 9, 10]

    # Pull real syllabus structure from the knowledge base (topics -> subtopics).
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

    # Flatten subtopics into weekly rows.
    week_count = 0
    for row in rows:
        topic_title = row["topic"]
        topic_code = row["topic_code"]
        subs = row["subtopics"]
        if not subs:
            # One week per topic when no subtopic breakdown is available.
            subtopic_list = [{
                "title": (f"Part {week_count + 1}" if lang == "en" else f"Sehemu ya {week_count + 1}"),
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
            week_count += 1
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

            month_idx = term_months[(week_count - 1) // 4] if week_count <= 4 * len(term_months) else term_months[-1]
            month = months[month_idx]
            week_row = {
                "week_number": week_count,
                "topic": topic_title,
                "subtopic": sub_title,
                "main_competence": main_comp,
                "specific_competence": spec_comp,
                "learning_activities": learning_activities,
                "specific_activities": sub_title,
                "month": month,
                "week": f"Week {week_count}" if lang == "en" else f"Wiki {week_count}",
                "periods": spec_periods,
                "reference": (
                    f"TIE (2023) {_subject_book(subject_label, class_name, lang)}"
                ),
                "teaching_methods": methods,
                "teaching_resources": (
                    ["Chati za uhusiano", "Vitu halisi", "Michezo ya Hisabati", "Vituo vya elimu"]
                    if lang == "sw"
                    else ["Charts of relationships", "Real life objects", "Math Games and Apps", "Educational channels"]
                ),
                "assessment_tools": (
                    "Maswali na majibu, class presentation, majaribio na kazi ya nyumbani"
                    if lang == "sw"
                    else "Quizzes, questions and answers, class presentation, tests and group discussion"
                ),
                "remarks": "Remarks Written here" if lang == "en" else "Maelezo yameandikwa hapa",
                "teaching_aids": ["Textbook", "Charts"] if lang == "en" else ["Kitabu", "Ramani"],
                "competences": [main_comp],
                "objectives": learning_activities,
                "references": [f"TIE Syllabus"],
                "assessment": "Exercises and Q&A" if lang == "en" else "Mazoezi na maswali",
            }
            weeks.append(week_row)

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
    _remarks_eval = LST("REMARKS :", "MAONI :")
    _teacher_eval = LST("Teacher's Evaluation / Self-Reflection", "Tathmini ya Mwalimu / Kujitathmini")
    _teacher_eval_hint = LST(
        "(Indicate the percentage of students who achieved the specific competence, effectiveness of teaching methods/resources, and required remediation.)",
        "(Onyesha asilimia ya wanafunzi waliofikia ujuzi mahususi, ufanisi wa mbinu/rasilimali za kufundisha, na marekebisho yanayohitajika.)",
    )
    _signature = LST("Signature", "Sahihi")

    sreg = h.get("students_registered", {}) or {}
    spres = h.get("students_present", {}) or {}
    ca = plan.get("competence_architecture", {}) or {}
    rs = plan.get("resources_strategies", {}) or {}
    matrix = plan.get("progression_matrix", []) or []
    activities = plan.get("teaching_activities", [])
    remarks = plan.get("remarks", "")

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
        body {{
            font-family: 'Times New Roman', Times, serif;
            margin: 20px;
            color: #000;
            background-color: #fff;
            line-height: 1.3;
        }}
        .lesson-container {{
            max-width: 950px;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 25px;
        }}
        .header {{
            text-align: center;
            font-weight: bold;
            margin-bottom: 20px;
        }}
        .header h2, .header h3, .header h4 {{
            margin: 3px 0;
            text-transform: uppercase;
        }}
        .header h2 {{ font-size: 16pt; }}
        .header h3 {{ font-size: 14pt; }}
        .header h4 {{ font-size: 13pt; text-decoration: underline; }}
        .header .title-line {{ font-size: 13pt; text-decoration: underline; text-transform: uppercase; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }}
        th, td {{
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 11pt;
            vertical-align: top;
        }}
        .bg-head {{
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
        }}
        .text-center {{ text-align: center; }}
        .bold {{ font-weight: bold; }}
        .sec {{
            margin-bottom: 12px;
        }}
        .sec-title {{
            font-weight: bold;
            margin: 14px 0 4px 0;
            text-decoration: underline;
        }}
        .sec-body {{
            margin-left: 12px;
        }}
        .refs {{
            margin: 4px 0 0 12px;
            font-style: italic;
        }}
        @media print {{
            body {{ margin: 0; }}
            .lesson-container {{ border: none; padding: 0; }}
            .no-print {{ display: none; }}
        }}
        .btn-print {{
            display: block;
            margin: 0 auto 15px auto;
            padding: 8px 20px;
            background: #000;
            color: #fff;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }}
        .btn-word {{
            display: block;
            margin: 0 auto 10px auto;
            padding: 8px 20px;
            background: #fff;
            color: #000;
            border: 2px solid #000;
            cursor: pointer;
            font-weight: bold;
        }}
    </style>
</head>
<body>

<div class="lesson-container">
    <table>
        <tr>
            <td style="width: 33%;"><strong>LESSON PLAN NO.</strong> ______</td>
            <td style="width: 34%;"><strong>{_e(_date)}</strong> . . . . . . . . . . . . . . . . . . . .</td>
            <td style="width: 33%;"><strong>{_e(_time)}</strong> . . . . . . . . . . . . . . . . . . . .</td>
        </tr>
        {school_name and f'''<tr>
            <td><strong>{_e(_school)}:</strong> {school_name}</td>
            <td><strong>{_e(_teacher)}:</strong> {teacher_name}</td>
            <td><strong>{_e(_class)}:</strong> {_e(class_name)}</td>
        </tr>'''}
        <tr>
            <td><strong>{_e(_subject)}:</strong> {_e(subject)}</td>
            <td><strong>{_e(LST('Topic', 'Mada'))}:</strong> {tp}</td>
            <td></td>
        </tr>
    </table>

    <div class="sec-title">1. CLASS INFORMATION</div>
    <table>
        <tr class="bg-head">
            <td rowspan="2" style="vertical-align: middle; width: 20%;">{_e(_students)}</td>
            <td colspan="3">{_e(_registered)}</td>
            <td colspan="3">{_e(_present)}</td>
        </tr>
        <tr class="bg-head">
            <td style="width: 13%;">{_e(_girls)}</td>
            <td style="width: 13%;">{_e(_boys)}</td>
            <td style="width: 14%;">{_e(_total)}</td>
            <td style="width: 13%;">{_e(_girls)}</td>
            <td style="width: 13%;">{_e(_boys)}</td>
            <td style="width: 14%;">{_e(_total)}</td>
        </tr>
        <tr class="text-center">
            <td class="bold">{_e(LST('Number', 'Idadi'))}</td>
            <td>{_e(sreg.get('girls', '') or '.')}</td>
            <td>{_e(sreg.get('boys', '') or '.')}</td>
            <td>{_e(sreg.get('total', '') or '.')}</td>
            <td>{_e(spres.get('girls', '') or '.')}</td>
            <td>{_e(spres.get('boys', '') or '.')}</td>
            <td>{_e(spres.get('total', '') or '.')}</td>
        </tr>
    </table>

    {comp_sections}

    <div class="sec-title">TEACHING AND LEARNING PROCESS</div>
    <table>
        <thead>
            <tr class="bg-head">
                <td style="width: 16%;">{_e(_stages)}</td>
                <td style="width: 11%;">{_e(_time_min)}</td>
                <td style="width: 27%;">{_e(_teaching_act)}</td>
                <td style="width: 27%;">{_e(_learning_act)}</td>
                <td style="width: 19%;">{_e(_assessment)}</td>
            </tr>
        </thead>
        <tbody>
        {stages_rows}
        </tbody>
    </table>

    <table>
        <tr class="bg-head">
            <td>{_e(_remarks_eval)}</td>
        </tr>
        <tr>
            <td>{remarks if remarks else _e(LST('--REMARKS TO WRITTEN HERE--', '--MAONI YAANDIKWE HAPA--'))}</td>
        </tr>
    </table>
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
        if isinstance(w.get('learning_activities'), list):
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
  @media print {{
    body {{ margin: 0.3cm; font-size: 9pt; }}
    .no-print {{ display: none !important; }}
    @page {{ margin: 0.5cm; size: A4 landscape; }}
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 16px; }}
  .title-block {{ text-align: center; border: 2px solid #000; padding: 10px; margin-bottom: 12px; }}
  .title-block h1 {{ font-size: 16pt; text-transform: uppercase; }}
  .meta-row {{ display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 12px; padding: 6px 0; border-bottom: 1px solid #000; flex-wrap: wrap; gap: 4px 20px; }}
  .meta-row span {{ white-space: nowrap; }}
  .meta-row strong {{ font-weight: bold; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }}
  th, td {{ border: 1px solid #000; padding: 4px 5px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }}
  th {{ background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 8pt; text-align: center; }}
  thead {{ display: table-header-group; }}
  tbody tr {{ page-break-inside: avoid; }}
  td.c {{ text-align: center; }}
  .actions {{ text-align: center; margin: 12px 0; }}
  .actions button {{ padding: 8px 20px; margin: 0 6px; cursor: pointer; font-size: 11pt; border: 1px solid #333; border-radius: 4px; background: #fff; }}
  .actions button:hover {{ background: #f5f5f5; }}
  .course-banner {{ border: 1px solid #000; border-bottom: none; font-weight: bold; text-align: left; padding: 6px 8px; font-size: 10pt; text-transform: uppercase; }}
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

<script>
function downloadAsWord() {{
  var html = document.documentElement.outerHTML;
  var blob = new Blob(
    ['<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:word" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>body {{ font-family: "Times New Roman", serif; font-size: 9pt; }} table {{ border-collapse: collapse; }} th, td {{ border: 1px solid #000; padding: 3px 4px; }} th {{ background: #f0f0f0; }}</style></head><body>' + html + '</body></html>'],
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
