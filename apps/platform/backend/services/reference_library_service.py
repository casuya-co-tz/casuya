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
    (re.compile(r"advanced\s*(mathematics|math)|mathematics\s*form\s*six|additional\s*math"), "additional_mathematics"),
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
