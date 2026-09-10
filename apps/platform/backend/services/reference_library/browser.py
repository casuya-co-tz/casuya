"""Reference library — browse/list/paginate and render reference documents."""

from __future__ import annotations

import json

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.models.reference_doc import ReferenceDoc


def list_reference_docs(
    db: Session,
    *,
    doc_type: str | None = None,
    subject_slug: str | None = None,
    form_level: int | None = None,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[ReferenceDoc]:
    q = db.query(ReferenceDoc)
    if doc_type in ("lesson_plan", "scheme_of_work"):
        q = q.filter(ReferenceDoc.doc_type == doc_type)
    if subject_slug:
        q = q.filter(ReferenceDoc.subject_slug == subject_slug)
    if form_level:
        q = q.filter(ReferenceDoc.form_level == form_level)
    if query:
        like = f"%{query}%"
        q = q.filter(or_(
            ReferenceDoc.title.ilike(like),
            ReferenceDoc.subject_name.ilike(like),
        ))
    return (
        q.order_by(ReferenceDoc.doc_type.asc(), ReferenceDoc.form_level.asc(), ReferenceDoc.title.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def count_reference_docs(db: Session, **filters) -> int:
    q = db.query(ReferenceDoc)
    if filters.get("doc_type") in ("lesson_plan", "scheme_of_work"):
        q = q.filter(ReferenceDoc.doc_type == filters["doc_type"])
    if filters.get("subject_slug"):
        q = q.filter(ReferenceDoc.subject_slug == filters["subject_slug"])
    if filters.get("form_level"):
        q = q.filter(ReferenceDoc.form_level == filters["form_level"])
    if filters.get("query"):
        like = f"%{filters['query']}%"
        q = q.filter(or_(
            ReferenceDoc.title.ilike(like),
            ReferenceDoc.subject_name.ilike(like),
        ))
    return q.count()


def get_reference_doc(db: Session, doc_id: str) -> ReferenceDoc | None:
    return db.query(ReferenceDoc).filter(ReferenceDoc.id == doc_id).first()


def get_reference_doc_by_source(db: Session, doc_type: str, source_id: str) -> ReferenceDoc | None:
    return (
        db.query(ReferenceDoc)
        .filter(ReferenceDoc.doc_type == doc_type, ReferenceDoc.source_id == source_id)
        .first()
    )


def serialize_doc(doc: ReferenceDoc) -> dict:
    try:
        content = json.loads(doc.content)
    except (TypeError, ValueError):
        content = {}
    return {
        "id": doc.id,
        "doc_type": doc.doc_type,
        "source_id": doc.source_id,
        "source_url": doc.source_url,
        "title": doc.title,
        "subject_name": doc.subject_name,
        "subject_slug": doc.subject_slug,
        "form_level": doc.form_level,
        "standard": doc.standard,
        "visible_to_students": doc.visible_to_students,
        "content": content,
    }


# ── HTML Rendering for reference docs ─────────────────────────────────

_SHARED_STYLE = """\
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:20px;color:#1e293b;background:#f8fafc;line-height:1.5;-webkit-font-smoothing:antialiased}
.container{max-width:960px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:28px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04)}
.title{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #e2e8f0}
.title h1{font-size:14pt;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.04em}
.title p{font-size:10pt;color:#64748b;margin-top:4px}
.header-bar{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:9pt;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
th,td{border:1px solid #e2e8f0;padding:7px 9px;font-size:9.5pt;vertical-align:top;line-height:1.4}
th{background:linear-gradient(135deg,#f1f5f9,#e8f0fe);font-weight:700;color:#334155;text-transform:uppercase;font-size:8pt;letter-spacing:.04em;text-align:center}
.sec{margin-bottom:14px}
.sec-title{font-weight:700;margin:16px 0 5px 0;font-size:10pt;color:#1e40af;text-transform:uppercase;letter-spacing:.04em;padding-bottom:3px;border-bottom:2px solid #dbeafe}
.sec-body{margin-left:12px;color:#334155;line-height:1.5;font-size:9.5pt}
@media print{body{margin:0;background:#fff}.container{border:none;padding:0;box-shadow:none;border-radius:0}}
"""


def render_reference_lesson_plan_html(content: dict) -> str:
    """Render a reference lesson plan (plan_details structure) as HTML."""
    from html import escape as _e

    details = content.get("plan_details") or []
    if not details:
        return f"<div class='container'><p style='color:#64748b'>No lesson plan data available.</p></div>"

    header_text = _e(content.get("header") or content.get("title") or "")
    title = _e(content.get("title") or "Lesson Plan")
    standard = _e(content.get("standard") or "")

    def _v(val):
        return _e(str(val)) if val else ""

    all_sections_html = ""
    for idx, d in enumerate(details):
        reg_girls = d.get("registered_girls", "")
        reg_boys = d.get("registered_boys", "")
        reg_total = d.get("total_registered_students", "")
        pres_girls = d.get("present_girls", "")
        pres_boys = d.get("present_boys", "")
        pres_total = d.get("total_present_students", "")

        main_comp = _v(d.get("main_competence"))
        spec_comp = _v(d.get("specific_competence"))
        main_act = _v(d.get("main_activity"))
        spec_act = _v(d.get("specific_activity"))
        resources = _v(d.get("teaching_learning_resources"))
        references = _v(d.get("references"))
        remarks = _v(d.get("remarks"))
        time_str = _v(d.get("time"))
        date_str = _v(d.get("date"))

        stages = d.get("teaching_structure") or []
        stage_rows = ""
        for s in stages:
            stage_rows += f"""<tr>
                <td style="font-weight:600">{_v(s.get('stage'))}</td>
                <td style="text-align:center">{_v(s.get('time'))}</td>
                <td>{_v(s.get('teaching_activities'))}</td>
                <td>{_v(s.get('learning_activities'))}</td>
                <td>{_v(s.get('assessment_criteria'))}</td>
            </tr>"""

        comp_html = ""
        if main_comp:
            comp_html += f'<div class="sec"><div class="sec-title">Main Competence</div><div class="sec-body">{main_comp}</div></div>'
        if spec_comp:
            comp_html += f'<div class="sec"><div class="sec-title">Specific Competence</div><div class="sec-body">{spec_comp}</div></div>'
        if main_act:
            comp_html += f'<div class="sec"><div class="sec-title">Main Activity</div><div class="sec-body">{main_act}</div></div>'
        if spec_act:
            comp_html += f'<div class="sec"><div class="sec-title">Specific Activity</div><div class="sec-body">{spec_act}</div></div>'
        if resources:
            comp_html += f'<div class="sec"><div class="sec-title">Teaching/Learning Resources</div><div class="sec-body">{resources}</div></div>'
        if references:
            comp_html += f'<div class="sec" style="margin-left:12px;font-style:italic;color:#64748b;font-size:9pt"><strong>References:</strong> {references}</div>'

        section_label = ""
        if len(details) > 1:
            section_label = f'<div class="sec-title" style="margin-top:20px">Section {idx + 1} of {len(details)}'
            if time_str or date_str:
                parts = []
                if date_str: parts.append(f"Date: {date_str}")
                if time_str: parts.append(f"Time: {time_str}")
                section_label += f' <span style="font-weight:400;font-size:9pt;color:#64748b">({", ".join(parts)})</span>'
            section_label += '</div>'

        all_sections_html += f"""
        {section_label}
        <table>
        <tr><td style="width:33%"><strong style="color:#1e40af;font-size:8pt">REGISTERED GIRLS:</strong> {_v(reg_girls) or '.'}</td>
            <td style="width:33%"><strong style="color:#1e40af;font-size:8pt">REGISTERED BOYS:</strong> {_v(reg_boys) or '.'}</td>
            <td style="width:34%"><strong style="color:#1e40af;font-size:8pt">TOTAL:</strong> {_v(reg_total) or '.'}</td></tr>
        <tr><td><strong style="color:#1e40af;font-size:8pt">PRESENT GIRLS:</strong> {_v(pres_girls) or '.'}</td>
            <td><strong style="color:#1e40af;font-size:8pt">PRESENT BOYS:</strong> {_v(pres_boys) or '.'}</td>
            <td><strong style="color:#1e40af;font-size:8pt">TOTAL:</strong> {_v(pres_total) or '.'}</td></tr>
        </table>
        {comp_html}
        <div class="sec-title">Teaching and Learning Process</div>
        <table>
        <thead><tr><th>Stage</th><th>Time</th><th>Teacher's Activities</th><th>Learners' Activities</th><th>Assessment</th></tr></thead>
        <tbody>{stage_rows}</tbody>
        </table>
        {remarks and f'<div class="sec"><div class="sec-title">Remarks</div><div class="sec-body">{remarks}</div></div>'}
        """

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{title}</title>
<style>{_SHARED_STYLE}</style></head><body>
<div class="container">
<div class="title"><h1>{title}</h1>{standard and f'<p>{standard}</p>'}</div>
{header_text and f'<div class="header-bar">{header_text}</div>'}
{all_sections_html}
</div></body></html>"""


def render_reference_scheme_html(content: dict) -> str:
    """Render a reference scheme of work (scheme_of_work_details structure) as HTML."""
    from html import escape as _e

    details = content.get("scheme_of_work_details") or []
    if not details:
        return "<div class='container'><p style='color:#64748b'>No scheme of work data available.</p></div>"

    title = _e(content.get("title") or "Scheme of Work")
    standard = _e(content.get("standard") or "")

    def _v(val):
        return _e(str(val)) if val else ""

    rows = ""
    for row in details:
        rows += f"""<tr>
            <td>{_v(row.get('one'))}</td>
            <td>{_v(row.get('two'))}</td>
            <td>{_v(row.get('three'))}</td>
            <td>{_v(row.get('four'))}</td>
            <td style="text-align:center">{_v(row.get('five'))}</td>
            <td style="text-align:center">{_v(row.get('six'))}</td>
            <td style="text-align:center">{_v(row.get('seven'))}</td>
            <td>{_v(row.get('eight'))}</td>
            <td>{_v(row.get('nine'))}</td>
            <td>{_v(row.get('ten'))}</td>
            <td>{_v(row.get('eleven'))}</td>
            <td>{_v(row.get('twelve'))}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{title}</title>
<style>{_SHARED_STYLE}
.table-wrap{{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px}}
.table-wrap table{{margin-bottom:0;min-width:700px}}
th{{font-size:7.5pt}}
@media print{{.table-wrap{{overflow:visible;border:none;border-radius:0}}.table-wrap table{{min-width:0}}}}
</style></head><body>
<div class="container">
<div class="title"><h1>{title}</h1>{standard and f'<p>{standard}</p>'}</div>
<div class="table-wrap">
<table>
<thead><tr>
<th>Main Competence</th><th>Specific Competence</th><th>Learning Activities</th><th>Specific Activities</th>
<th>Month</th><th>Week</th><th>Periods</th><th>Reference</th>
<th>Methods</th><th>Resources</th><th>Assessment</th><th>Remarks</th>
</tr></thead>
<tbody>{rows}</tbody>
</table>
</div>
</div></body></html>"""
