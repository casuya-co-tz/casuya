"""HTML renderer for lesson plans (the official TIE CBC lesson-plan format)."""

from __future__ import annotations

from .render_lesson_css import LESSON_PLAN_CSS
from .utils import _fill_lesson_plan_placeholders


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
    is_sw = str(h.get("lang", "")).lower() == "sw" or any(
        w in (h.get("topic", "") + h.get("subject", "")).lower()
        for w in ["somo", "darasa", "mada", "kujifunza"]
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
        {LESSON_PLAN_CSS}
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
            <td></td>
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