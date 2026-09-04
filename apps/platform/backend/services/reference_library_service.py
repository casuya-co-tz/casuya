"""Reference library — browse/search imported official lessons and schemes.

Imported documents (from the public reference platform) are stored in the
``reference_docs`` table by the import script. This service maps their raw
metadata (title / standard) onto Casuya's ``subject_slug`` + ``form_level``
best-effort, and exposes browse, search and get-by-id helpers used by the API
and by generation-time grounding.
"""

from __future__ import annotations

import json
import re

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.models.reference_doc import ReferenceDoc

# Keyword -> Casuya subject_slug mapping (best-effort). Ordered so more
# specific phrases (e.g. "advanced mathematics") match before generic ones.
_SUBJECT_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"advanced\s*(mathematics|math)|additional\s*math"), "additional_mathematics"),
    (re.compile(r"basic\s*mathematics|mathematics|mathemat|hisabati|kuhesabu|numeracy|\bmath\b"), "mathematics"),
    (re.compile(r"book[\s-]*keeping|book[\s-]*keeping\b|accountancy|\baccounting|\baccount\b"), "bookkeeping"),
    (re.compile(r"business\s*studies|commerce|\bbiashara\b"), "business_studies"),
    (re.compile(r"computer\s*(science|applications)|\bcomputer\b|teknolojia ya habari"), "computer_science"),
    (re.compile(r"bible\s*knowledge|\bbible\b|\bdini\b"), "bible_knowledge"),
    (re.compile(r"agriculture|\bkilimo\b"), "agriculture"),
    (re.compile(r"biology|biologia"), "biology"),
    (re.compile(r"chemistry|\bkemia\b"), "chemistry"),
    (re.compile(r"physics|\bfizikia\b"), "physics"),
    (re.compile(r"geography|jiografia|mazingira"), "geography"),
    (re.compile(r"civics\s*and\s*moral|civics|uraia\s*na\s*maadili|maadili|moral\s*education|historia\s*na\s*maadili"), "history_civics"),
    (re.compile(r"history\s*of?\s*tanzania|historia\s*ya\s*tanzania"), "history"),
    (re.compile(r"history|\bhistoria\b"), "history"),
    (re.compile(r"english\s*language|english|reading|writing|listening\s*and\s*speaking|\bkuandika\b|\bkusoma\b"), "english"),
    (re.compile(r"kiswahili|fasihi|\blugha\b"), "kiswahili"),
]

_FORM_WORDS = {
    "darasa la kwanza": 1, "kidato cha kwanza": 1, "vendor one": 1,
    "standard one": 1, "standard 1": 1, "form one": 1, "form 1": 1, "std 1": 1,
    "standard two": 2, "standard 2": 2, "form two": 2, "form 2": 2, "std 2": 2,
    "kidato cha pili": 2, "darasa la pili": 2,
    "standard three": 3, "standard 3": 3, "form three": 3, "form 3": 3, "std 3": 3,
    "darasa la tatu": 3, "kidato cha tatu": 3,
    "standard four": 4, "standard 4": 4, "form four": 4, "form 4": 4, "std 4": 4,
    "darasa la nne": 4, "kidato cha nne": 4,
    "standard five": 5, "standard 5": 5, "form five": 5, "form 5": 5, "std 5": 5,
    "darasa la tano": 5, "kidato cha tano": 5,
    "standard six": 6, "standard 6": 6, "form six": 6, "form 6": 6, "std 6": 6,
    "darasa la sita": 6, "kidato cha sita": 6,
    "standard seven": 7, "standard 7": 7, "form seven": 7, "form 7": 7, "std 7": 7,
    "darasa la saba": 7, "kidato cha saba": 7,
}

_ORDINAL = {
    "kwanza": 1, "pili": 2, "tatu": 3, "nne": 4, "tano": 5,
    "sita": 6, "saba": 7, "nane": 8, "tisa": 9, "kumi": 10,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}

_FORM_INT = re.compile(r"\b(form|std|class|standard|kidato|darasa)\s*(?:cha|la)?\s*(\d{1,2})\b", re.I)


def map_subject_slug(raw_subject_name: str | None, title: str) -> str | None:
    """Best-effort map a raw subject name / reference title to a Casuya slug."""
    text = " ".join(x for x in [raw_subject_name, title] if x)
    lowered = text.lower()
    for pattern, slug in _SUBJECT_RULES:
        if pattern.search(lowered):
            return slug
    return None


def _form_from_standard(standard: str | None) -> int | None:
    if not standard:
        return None
    m = _FORM_INT.search(standard)
    if m:
        try:
            return int(m.group(2))
        except (TypeError, ValueError):
            return None
    key = standard.strip().lower()
    if key in _FORM_WORDS:
        return _FORM_WORDS[key]
    return None


def _form_from_title(title: str) -> int | None:
    lowered = title.lower()
    for phrase, level in _FORM_WORDS.items():
        if phrase in lowered:
            return level
    # "Darasa la X" / "Kidato cha X" / "X" ordinal form
    m = re.search(r"\b(?:darasa la|kidato cha|standard|form|class)\s+([a-z]+)\b", lowered)
    if m and m.group(1) in _ORDINAL:
        return _ORDINAL[m.group(1)]
    m = _FORM_INT.search(lowered)
    if m:
        try:
            return int(m.group(2))
        except (TypeError, ValueError):
            return None
    return None


def map_form_level(standard: str | None, title: str) -> int | None:
    """Best-effort map a document to Casuya's 1..7 form/standard level."""
    return _form_from_standard(standard) or _form_from_title(title) or None


def _subject_name_from_title(title: str) -> str | None:
    """Strip the leading UPPERCASE header to grab a subject-ish token."""
    lowered = title.lower()
    for pattern, _ in _SUBJECT_RULES:
        m = pattern.search(lowered)
        if m:
            return title[m.start():m.end()].strip()
    return None


def parse_metadata(title: str, standard: str | None) -> tuple[str | None, int | None, str | None]:
    """Return ``(subject_slug, form_level, subject_name)`` for a reference doc."""
    return (
        map_subject_slug(None, title),
        map_form_level(standard, title),
        _subject_name_from_title(title),
    )


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


def fetch_reference_grounding(
    subject_slug: str,
    form_level: int | None,
    topic: str | None = None,
    doc_type: str | None = None,
) -> dict | None:
    """Return the best-matching reference document content for grounding.

    Opens its own read-only session so offline generators can call it without
    threading a ``Session`` through. Best-effort and side-effect free: returns
    ``None`` when no database, table or matching row is available, so callers
    fall back to their generic content rather than failing.
    """
    try:
        from backend.config.database import get_db

        db = next(get_db())
    except Exception:
        return None
    try:
        q = db.query(ReferenceDoc).filter(ReferenceDoc.subject_slug == subject_slug)
        if form_level:
            q = q.filter(ReferenceDoc.form_level == form_level)
        if doc_type:
            q = q.filter(ReferenceDoc.doc_type == doc_type)
        docs = list(q.all())
        if not docs:
            return None

        def _score(doc: ReferenceDoc) -> int:
            score = 0
            if topic and topic.lower() in (doc.title or "").lower():
                score += 3
            if doc_type and (doc.doc_type or "") == doc_type:
                score += 1
            return score

        best = max(docs, key=_score)
        try:
            content = json.loads(best.content)
        except (TypeError, ValueError):
            content = {}
        return {
            "doc_type": best.doc_type,
            "title": best.title,
            "standard": best.standard,
            "content": content,
        }
    finally:
        db.close()


def _plan_field(content: dict, *keys: str) -> str:
    """First non-empty value across any lesson plan_detail for the given keys."""
    for detail in content.get("plan_details") or []:
        for key in keys:
            value = detail.get(key)
            if value:
                return value
    return ""


def _split_delimited(value) -> list:
    """Split a comma-delimited string into clean, de-duplicated items."""
    items = []
    for part in (value or "").split(","):
        item = " ".join(str(part).split()).strip()
        if item and item not in items:
            items.append(item)
    return items


def _collapsed(text) -> str:
    return " ".join(str(text).split()).strip()


def _as_citations(value) -> list:
    """Normalize a plan-detail references value into one or more citation
    strings. Handles prose strings, dicts, and char/label-split lists."""
    if not value:
        return []
    if isinstance(value, list | tuple):
        items = [_collapsed(ref.get("name") or ref.get("title") if isinstance(ref, dict) else ref)
                 for ref in value]
        items = [i for i in items if i]
        if items and all(len(i) == 1 for i in items):
            return [_collapsed("".join(items))]
        return items
    return [_collapsed(value)]


def lesson_plan_grounding(content: dict) -> dict:
    """Extract teacher-facing enrichments (comp/activity/resources/references)
    from a reference lesson-plan payload. Detail values are mostly strings
    (comma/line-delimited); references are kept whole as citations while
    resources are split into individual items."""
    references = []
    for detail in content.get("plan_details") or []:
        for ref in _as_citations(detail.get("references")) + _as_citations(detail.get("resource_references")):
            if ref and ref not in references:
                references.append(ref)
    resources_seen = []
    resources = []
    for detail in content.get("plan_details") or []:
        res_value = detail.get("teaching_learning_resources") or detail.get("resources") or ""
        for item in _split_delimited(res_value):
            if item not in resources_seen:
                resources_seen.append(item)
                resources.append(item)
    return {
        "main_competence": _plan_field(content, "main_competence"),
        "specific_competence": _plan_field(content, "specific_competence"),
        "main_activity": _plan_field(content, "main_activity"),
        "specific_activity": _plan_field(content, "specific_activity"),
        "resources": resources,
        "references": references,
    }


_SCHEME_HEADER_LABELS = {
    "main competence", "specific competence", "learning activities",
    "specific activities", "teaching and learning methods",
    "teaching and learning resources", "assessment tools", "ref",
    # Swahili variants of the same column labels
    "ujuzi mkuu", "ujuzi mahususi", "shughuli za ujifunzaji",
    "shughuli mahususi", "mbinu za ufundishaji na ujifunzaji",
    "mbinu za ufundishaji na ujifunzaji na zana", "rasilimali za kufundishia na kujifunzia",
    "zana za upimaji", "zana za tathmini", "rejea", "maoni",
}

_HEADER_COLUMNS = ("one", "two", "eight", "nine", "ten", "eleven", "twelve", "thirteen")


def _is_scheme_header_row(row: dict) -> bool:
    # A header row carries the column's own label (English or Swahili) in one or
    # more of its fields; data rows carry real competence/method content instead.
    normalized = [str(row.get(col) or "").strip().lower() for col in _HEADER_COLUMNS]
    return any(v in _SCHEME_HEADER_LABELS for v in normalized)


def _scheme_row_value(scheme_details: list, *keys: str) -> str:
    for row in scheme_details:
        if _is_scheme_header_row(row):
            continue
        for key in keys:
            value = row.get(key)
            if isinstance(value, list | tuple):
                value = ", ".join(str(v) for v in value if v)
            if value:
                return str(value).strip()
    return ""


def scheme_of_work_grounding(content: dict) -> dict:
    """Extract method/assessment/reference enrichments from a reference
    scheme-of-work payload via its per-row fields. Skips the leading header
    row (which carries the table's column labels rather than data)."""
    rows = content.get("scheme_of_work_details") or []
    data_rows = [r for r in rows if not _is_scheme_header_row(r)]
    methods = [m for m in (_scheme_row_value(data_rows, "nine", "teaching_and_learning_methods",
                                             "teaching_methods") or "").split(",") if m.strip()]
    if not methods:
        methods = [m for m in (_scheme_row_value(data_rows, "ten") or "").split(",") if m.strip()]
    assessment = _scheme_row_value(data_rows, "eleven", "assessment_tools", "assessment") or ""
    resources = [r for r in
                 (_scheme_row_value(data_rows, "ten", "teaching_and_learning_resources",
                                    "teaching_resources") or "").split(",") if r.strip()] or \
                [r for r in (_scheme_row_value(data_rows, "ten") or "").split(",") if r.strip()]
    references = [r for r in (_scheme_row_value(data_rows, "eight", "reference", "ref") or "").split(",") if r.strip()]
    competences = _scheme_row_value(data_rows, "one", "two",
                                    "main_competence", "specific_competence") or ""
    return {
        "methods": methods,
        "assessment": assessment,
        "resources": resources,
        "references": references,
        "competences": competences,
    }
