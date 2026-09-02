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
from backend.services.syllabus_service import get_curriculum_context

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
    school_name, teacher_name, number_of_students, duration_minutes, period,
) -> str:
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    time_to = _time_to(duration_minutes)
    subtopic_display = subtopic or ("General Overview" if lang == "en" else "Mawazo ya Jumla")
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"

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
            "number_of_students": number_of_students,
        },
        "competences": ["Competence 1", "Competence 2"],
        "specific_objectives": ["Objective 1", "Objective 2"],
        "teaching_aids": ["Aid 1", "Aid 2"],
        "references": ["TIE Syllabus", "Textbook"],
        "teaching_activities": [
            {"phase": "Introduction", "time": "10 min", "teacher_activity": "...",
             "student_activity": "...", "teaching_aids": "...", "remarks_assessment": "..."},
            {"phase": "Main Lesson", "time": "25 min", "teacher_activity": "...",
             "student_activity": "...", "teaching_aids": "...", "remarks_assessment": "..."},
            {"phase": "Conclusion", "time": "5 min", "teacher_activity": "...",
             "student_activity": "...", "teaching_aids": "...", "remarks_assessment": "..."},
        ],
        "general_objectives": ["General objective 1"],
        "remarks": "Additional notes",
    }

    if lang == "sw":
        return (
            "Unatengeneza Mpango wa Somo rasmi wa TIE (Taasisi ya Elimu Tanzania) "
            "kwa Misingumo ya Ujuzi.\n"
            "MUHIMU SANA: Toa JSON SAHIHI pekee — bila markdown, maelezo, au vizuizi vya msimbo.\n\n"
            f"MISEMBO:\n{json.dumps(json_schema, indent=2, ensure_ascii=False)}\n\n"
            f"CONTEXTO YA MPANGO:\n{curriculum_ctx}\n\n"
            "Vifaa vya ufundishaji na marejeo lazima vitoke kutoka kwenye misingumo hapo juu.\n"
            "Kila shughuli lazima iwe na maelezo kamili — si tu majina ya awamu.\n"
            "Lengo la jumla lazima liunganishwe na malengo mahususi.\n"
            f"Lugha: Kiswahili"
        )

    return (
        "You are generating an official Tanzania Institute of Education (TIE) "
        "Competence-Based Lesson Plan.\n"
        "CRITICAL: Output ONLY valid JSON matching this schema — no markdown, no explanations.\n\n"
        f"JSON SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        "Teaching aids and references MUST come from the curriculum context above.\n"
        "Each activity must have FULL descriptions — not just phase names.\n"
        "General objectives must connect to specific learning outcomes.\n"
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
                "week_number": 1,
                "topic": "Topic Title",
                "subtopic": "Subtopic",
                "competences": ["Competence 1"],
                "objectives": ["Objective 1"],
                "periods": 4,
                "teaching_aids": ["Aid 1"],
                "references": ["TIE Syllabus"],
                "assessment": "Assessment method",
                "remarks": "Notes",
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
            f"Lugha: Kiswahili"
        )

    return (
        "You are generating an official TIE Competence-Based Scheme of Work.\n"
        "CRITICAL: Output ONLY valid JSON matching this schema.\n\n"
        f"JSON SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        f"TOPICS TO COVER:\n{topic_list}\n\n"
        "Generate weeks covering ALL topics listed above. Each week: 3-5 periods, one subtopic.\n"
        f"Language: English"
    )


# ── Offline fallback generators ────────────────────────────────────────────


def _build_lesson_plan_offline(
    *, subject_slug, subject_label, form_level, topic, subtopic,
    school_name, teacher_name, number_of_students, duration_minutes, period, lang,
) -> dict:
    intro_time = max(5, duration_minutes // 8)
    conc_time = max(5, duration_minutes // 8)
    main_time = duration_minutes - intro_time - conc_time
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    time_to = _time_to(duration_minutes)
    subtopic_display = subtopic or ("General Overview" if lang == "en" else "Mawazo ya Jumla")
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"

    if lang == "sw":
        phases = [
            {"phase": "Uanzishaji", "time": f"dakika {intro_time}",
             "teacher_activity": f"Anawataka wanafunzi kukumbuka somo la awali kuhusu {topic}. Anaweka maswali ya kuchochea fikira.",
             "student_activity": "Wanasoma na kujibu maswali ya mwalimu.",
             "teaching_aids": "Bao, ramani", "remarks_assessment": "Kagua uelewa wa somo la awali"},
            {"phase": "Somo Kuu", "time": f"dakika {main_time}",
             "teacher_activity": f"Anafundisha {subtopic_display} kwa undani. Anatumia mifano na mazoezi.",
             "student_activity": "Wanasoma, kuchukua noti, na kushiriki mazoezi.",
             "teaching_aids": "Kitabu cha somo, mifano", "remarks_assessment": "Ufuatiliaji wa mazoezi"},
            {"phase": "Hitimisho", "time": f"dakika {conc_time}",
             "teacher_activity": "Anafanya muhtasari wa somo lote na kuweka maswali ya kufikiria.",
             "student_activity": "Wajibu maswali na kuuliza maswali ya ziada.",
             "teaching_aids": "Muhtasari wa bao", "remarks_assessment": "Kagua kama lengo limefikiwa"},
        ]
        objectives = [
            f"Mwanafunzi ataweza kueleza {subtopic_display}",
            f"Mwanafunzi ataweza kutumia ujuzi wa {subtopic_display}",
        ]
        competences = [f"Ujuzi wa {subject_label}", f"Ujuzi wa {topic}"]
        aids = ["Kitabu cha somo", "Ramani / michoro"]
        general_obj = [f"Kuelewa na kutumia maarifa ya {topic} kwa maisha ya kila siku"]
    else:
        phases = [
            {"phase": "Introduction", "time": f"{intro_time} min",
             "teacher_activity": f"Greet students and review the previous lesson on {topic}. Pose questions to stimulate thinking.",
             "student_activity": "Listen, respond to teacher's questions, and recall prior knowledge.",
             "teaching_aids": "Chart, previous lesson notes", "remarks_assessment": "Check prior knowledge"},
            {"phase": "Main Lesson", "time": f"{main_time} min",
             "teacher_activity": f"Teach {subtopic_display} in detail. Use examples, diagrams, and guided practice.",
             "student_activity": "Take notes, participate in exercises, and discuss with peers.",
             "teaching_aids": "Textbook, diagrams, worksheets", "remarks_assessment": "Monitor exercises"},
            {"phase": "Conclusion", "time": f"{conc_time} min",
             "teacher_activity": "Summarise key points. Assign follow-up work or pose reflective questions.",
             "student_activity": "Ask questions, summarise what they learned.",
             "teaching_aids": "Board summary", "remarks_assessment": "Final comprehension check"},
        ]
        objectives = [
            f"The student will be able to describe {subtopic_display}",
            f"The student will be able to apply knowledge of {subtopic_display}",
        ]
        competences = [f"Competence in {subject_label}", f"Competence in {topic}"]
        aids = ["Textbook", "Charts / diagrams"]
        general_obj = [f"Understand and apply knowledge of {topic} in daily life"]

    return {
        "header": {
            "school_name": school_name, "teacher_name": teacher_name,
            "class_name": class_name, "subject": subject_label,
            "topic": topic, "subtopic": subtopic_display,
            "date": today, "time_from": "08:00", "time_to": time_to,
            "period": period, "number_of_students": number_of_students,
        },
        "competences": competences,
        "specific_objectives": objectives,
        "teaching_aids": aids,
        "references": ["TIE Syllabus", f"{subject_label} Textbook"],
        "teaching_activities": phases,
        "general_objectives": general_obj,
        "remarks": "",
    }


def _build_scheme_offline(
    *, subject_slug, subject_label, form_level, term, academic_year,
    school_name, teacher_name, topics, lang,
) -> dict:
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"
    num_weeks = 12 if "1" in term else (12 if "2" in term else 8)
    weeks = []

    for i in range(1, num_weeks + 1):
        topic_title = topics[i - 1] if i <= len(topics) else f"Topic {i}"
        if lang == "sw":
            weeks.append({
                "week_number": i, "topic": topic_title, "subtopic": f"Sehemu ya {i}",
                "competences": [f"Ujuzi wa {topic_title}"],
                "objectives": [f"Mwanafunzi ataweza kueleza {topic_title}"],
                "periods": 4, "teaching_aids": ["Kitabu", "Ramani"],
                "references": ["Misingumo ya TIE"],
                "assessment": "Mazoezi na maswali", "remarks": "",
            })
        else:
            weeks.append({
                "week_number": i, "topic": topic_title, "subtopic": f"Part {i}",
                "competences": [f"Competence in {topic_title}"],
                "objectives": [f"Student will understand {topic_title}"],
                "periods": 4, "teaching_aids": ["Textbook", "Charts"],
                "references": ["TIE Syllabus"],
                "assessment": "Exercises and Q&A", "remarks": "",
            })

    return {
        "header": {
            "school_name": school_name, "teacher_name": teacher_name,
            "subject": subject_label, "class_name": class_name,
            "term": term, "academic_year": academic_year,
        },
        "weeks": weeks,
    }


# ── HTML Rendering ─────────────────────────────────────────────────────────

def render_lesson_plan_html(plan: dict) -> str:
    h = plan.get("header", {})
    activities = plan.get("teaching_activities", [])
    is_sw = any(
        w in (h.get("topic", "") + h.get("subject", "")).lower()
        for w in ["historia", "maadili", "kiswahili", "uraia"]
    )

    labels = {
        "school": "School Name" if not is_sw else "Jina la Shule",
        "teacher": "Teacher" if not is_sw else "Mwalimu",
        "class": "Class" if not is_sw else "Darasa",
        "subject": "Subject" if not is_sw else "Somo",
        "topic": "Topic" if not is_sw else "Mada",
        "subtopic": "Subtopic" if not is_sw else "Sehemu ya Mada",
        "date": "Date" if not is_sw else "Tarehe",
        "time": "Time" if not is_sw else "Muda",
        "period": "Period" if not is_sw else "Kipindi",
        "students": "No. of Students" if not is_sw else "Idadi ya Wanafunzi",
        "competences": "Core Competences" if not is_sw else "Ujuzi Mkuu",
        "objectives": "Specific Objectives" if not is_sw else "Malengo Mahususi",
        "general_obj": "General Objectives" if not is_sw else "Malengo ya Jumla",
        "aids": "Teaching & Learning Aids" if not is_sw else "Zana za Kufundisha na Kujifunza",
        "references": "References" if not is_sw else "Marejeo",
        "activities": "Teaching and Learning Activities" if not is_sw else "Shughuli za Kufundisha na Kujifunza",
        "phase": "Phase" if not is_sw else "Awamu",
        "time_col": "Time" if not is_sw else "Muda",
        "teacher_act": "Teacher Activity" if not is_sw else "Shughuli ya Mwalimu",
        "student_act": "Student Activity" if not is_sw else "Shughuli ya Mwanafunzi",
        "aids_col": "Teaching Aids" if not is_sw else "Zana za Kufundisha",
        "remarks": "Remarks / Assessment" if not is_sw else "Mrejesho / Tathmini",
        "remarks_note": "Remarks" if not is_sw else "Maelezo",
    }

    def _li(items):
        if not items:
            return ""
        if isinstance(items, str):
            items = [items]
        return "".join(f"<li>{_e(str(i))}</li>" for i in items)

    def _e(s):
        from html import escape
        return escape(str(s))

    acts_rows = ""
    for a in activities:
        acts_rows += f"""<tr>
            <td>{_e(a.get('phase', ''))}</td>
            <td>{_e(a.get('time', ''))}</td>
            <td>{_e(a.get('teacher_activity', ''))}</td>
            <td>{_e(a.get('student_activity', ''))}</td>
            <td>{_e(a.get('teaching_aids', ''))}</td>
            <td>{_e(a.get('remarks_assessment', ''))}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="{'sw' if is_sw else 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_e(h.get('topic', 'Lesson Plan'))}</title>
<style>
  @media print {{
    body {{ margin: 0.5cm; font-size: 11pt; }}
    .no-print {{ display: none !important; }}
    @page {{ margin: 1cm; size: A4 landscape; }}
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 20px; }}
  .title-block {{ text-align: center; border: 2px solid #000; padding: 12px; margin-bottom: 16px; }}
  .title-block h1 {{ font-size: 18pt; text-transform: uppercase; letter-spacing: 1px; }}
  .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; border: 1px solid #000; margin-bottom: 16px; font-size: 10.5pt; }}
  .meta-grid .field {{ padding: 5px 8px; border-bottom: 1px solid #ccc; display: flex; gap: 6px; }}
  .meta-grid .label {{ font-weight: bold; white-space: nowrap; min-width: 120px; }}
  .section {{ margin-bottom: 12px; }}
  .section h3 {{ font-size: 11pt; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 6px; text-transform: uppercase; }}
  .section ul {{ margin-left: 18px; font-size: 10.5pt; }}
  .section ul li {{ margin-bottom: 3px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 12px; }}
  th, td {{ border: 1px solid #000; padding: 5px 6px; text-align: left; vertical-align: top; }}
  th {{ background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 9.5pt; }}
  .footer-note {{ font-size: 9pt; color: #555; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 6px; }}
  .actions {{ text-align: center; margin: 16px 0; }}
  .actions button {{ padding: 8px 20px; margin: 0 6px; cursor: pointer; font-size: 11pt; border: 1px solid #333; border-radius: 4px; background: #fff; }}
  .actions button:hover {{ background: #f5f5f5; }}
</style>
</head>
<body>
<div class="actions no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <button onclick="downloadAsWord()">Download as Word</button>
</div>

<div class="title-block">
  <h1>{_e(h.get('school_name', 'School Name'))}</h1>
  <p style="font-size:12pt; margin-top:4px;">{labels['topic']}: {_e(h.get('topic', ''))}</p>
</div>

<div class="meta-grid">
  <div class="field"><span class="label">{labels['school']}:</span> {_e(h.get('school_name', ''))}</div>
  <div class="field"><span class="label">{labels['teacher']}:</span> {_e(h.get('teacher_name', ''))}</div>
  <div class="field"><span class="label">{labels['class']}:</span> {_e(h.get('class_name', ''))}</div>
  <div class="field"><span class="label">{labels['subject']}:</span> {_e(h.get('subject', ''))}</div>
  <div class="field"><span class="label">{labels['topic']}:</span> {_e(h.get('topic', ''))}</div>
  <div class="field"><span class="label">{labels['subtopic']}:</span> {_e(h.get('subtopic', ''))}</div>
  <div class="field"><span class="label">{labels['date']}:</span> {_e(h.get('date', ''))}</div>
  <div class="field"><span class="label">{labels['time']}:</span> {_e(h.get('time_from', ''))} - {_e(h.get('time_to', ''))}</div>
  <div class="field"><span class="label">{labels['period']}:</span> {_e(h.get('period', ''))}</div>
  <div class="field"><span class="label">{labels['students']}:</span> {_e(h.get('number_of_students', ''))}</div>
</div>

<div class="section">
  <h3>{labels['competences']}</h3>
  <ul>{_li(plan.get('competences', []))}</ul>
</div>

<div class="section">
  <h3>{labels['general_obj']}</h3>
  <ul>{_li(plan.get('general_objectives', []))}</ul>
</div>

<div class="section">
  <h3>{labels['objectives']}</h3>
  <ul>{_li(plan.get('specific_objectives', []))}</ul>
</div>

<div class="section">
  <h3>{labels['activities']}</h3>
  <table>
    <thead>
      <tr>
        <th style="width:12%">{labels['phase']}</th>
        <th style="width:9%">{labels['time_col']}</th>
        <th style="width:25%">{labels['teacher_act']}</th>
        <th style="width:25%">{labels['student_act']}</th>
        <th style="width:14%">{labels['aids_col']}</th>
        <th style="width:15%">{labels['remarks']}</th>
      </tr>
    </thead>
    <tbody>{acts_rows}</tbody>
  </table>
</div>

<div class="section">
  <h3>{labels['aids']}</h3>
  <ul>{_li(plan.get('teaching_aids', []))}</ul>
</div>

<div class="section">
  <h3>{labels['references']}</h3>
  <ul>{_li(plan.get('references', []))}</ul>
</div>

{_e(plan.get('remarks', '')) and f'<div class="footer-note">{_e(plan.get("remarks", ""))}</div>'}

<script>
function downloadAsWord() {{
  var html = document.documentElement.outerHTML;
  var blob = new Blob(
    ['<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:word" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>body {{ font-family: "Times New Roman", serif; }} table {{ border-collapse: collapse; }} th, td {{ border: 1px solid #000; padding: 5px; }} th {{ background: #f0f0f0; }}</style></head><body>' + html + '</body></html>'],
    {{ type: 'application/msword' }}
  );
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'lesson_plan_' + (document.title || 'document').replace(/[^a-z0-9]/gi, '_') + '.doc';
  a.click();
  URL.revokeObjectURL(url);
}}
</script>
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
        "wk": "Week" if not is_sw else "Wiki",
        "topic": "Topic" if not is_sw else "Mada",
        "subtopic": "Subtopic" if not is_sw else "Sehemu ya Mada",
        "comps": "Competences" if not is_sw else "Ujuzi",
        "objs": "Objectives" if not is_sw else "Malengo",
        "periods": "Periods" if not is_sw else "Vipindi",
        "aids": "Teaching Aids" if not is_sw else "Zana za Kufundisha",
        "refs": "References" if not is_sw else "Marejeo",
        "assess": "Assessment" if not is_sw else "Tathmini",
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
        rows += f"""<tr>
            <td style="text-align:center">{w.get('week_number', '')}</td>
            <td>{_e(w.get('topic', ''))}</td>
            <td>{_e(w.get('subtopic', ''))}</td>
            <td>{_li(w.get('competences', []))}</td>
            <td>{_li(w.get('objectives', []))}</td>
            <td style="text-align:center">{w.get('periods', '')}</td>
            <td>{_li(w.get('teaching_aids', []))}</td>
            <td>{_li(w.get('references', []))}</td>
            <td>{_e(w.get('assessment', ''))}</td>
            <td>{_e(w.get('remarks', ''))}</td>
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
  table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }}
  th, td {{ border: 1px solid #000; padding: 4px 5px; text-align: left; vertical-align: top; }}
  th {{ background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 8pt; }}
  .actions {{ text-align: center; margin: 12px 0; }}
  .actions button {{ padding: 8px 20px; margin: 0 6px; cursor: pointer; font-size: 11pt; border: 1px solid #333; border-radius: 4px; background: #fff; }}
  .actions button:hover {{ background: #f5f5f5; }}
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

<table>
<thead>
<tr>
  <th style="width:5%">{labels['wk']}</th>
  <th style="width:14%">{labels['topic']}</th>
  <th style="width:12%">{labels['subtopic']}</th>
  <th style="width:14%">{labels['comps']}</th>
  <th style="width:14%">{labels['objs']}</th>
  <th style="width:6%">{labels['periods']}</th>
  <th style="width:12%">{labels['aids']}</th>
  <th style="width:10%">{labels['refs']}</th>
  <th style="width:10%">{labels['assess']}</th>
  <th style="width:8%">{labels['rem']}</th>
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
