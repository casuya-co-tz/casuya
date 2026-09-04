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
    (re.compile(r"history\s*of?\s*tanzania|historia\s*ya\s*tanzania|historia\s*na\s*maadili"), "history"),
    (re.compile(r"history|\bhistoria\b"), "history"),
    (re.compile(r"civics\s*and\s*moral|civics|uraia\s*na\s*maadili|maadili|moral\s*education"), "history_civics"),
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
    return len(list_reference_docs(db, limit=100000, offset=0, **filters))


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
        "content": content,
    }


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
