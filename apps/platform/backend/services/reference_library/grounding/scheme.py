"""Reference library — scheme-of-work grounding enrichment helpers."""

from __future__ import annotations

from .plan import _split_delimited


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


_NONTEACHING_TOPIC_HINTS = (
    "mid-term", "midterm", "terminal", "revision", "annual exam",
    "examination", "closing", "likizo", "mtihani", "break",
)


def _is_non_teaching_scheme_row(row: dict) -> bool:
    """True when a scheme row is an exam/break/revision placeholder rather than
    a teaching week. Detected via the explicit ``non_teaching`` flag or the
    row's topic/competence text."""
    if row.get("non_teaching"):
        return True
    topic = f"{_clean_row_value(row.get('topic'))} {_clean_row_value(row.get('one'))}".lower()
    return any(hint in topic for hint in _NONTEACHING_TOPIC_HINTS)


def _clean_row_value(value):
    """Collapse whitespace in a scheme row's text field."""
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def scheme_of_work_grounding(content: dict) -> dict:
    """Extract method/assessment/reference enrichments from a reference
    scheme-of-work payload via its per-row fields, plus a normalized ``rows``
    list (one entry per non-header row) carrying the same fields a scheme
    generator needs: topic, week, competences, activities, strategies/methods,
    resources, assessment tools and teacher remarks. Skips the leading header
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

    normalized = []
    for row in data_rows:
        if not isinstance(row, dict):
            continue
        methods_list = [m for m in _split_delimited(row.get("nine"))] or \
                       [m for m in _split_delimited(row.get("ten"))]
        resources_list = [r for r in _split_delimited(row.get("ten"))]
        normalized.append({
            "topic": _clean_row_value(row.get("topic")),
            "week": _clean_row_value(row.get("six")),
            "month": _clean_row_value(row.get("five")),
            "periods": _clean_row_value(row.get("seven")),
            "main_competence": _clean_row_value(row.get("one")),
            "specific_competence": _clean_row_value(row.get("two")),
            "main_activity": _clean_row_value(row.get("three")),
            "specific_activity": _clean_row_value(row.get("four")),
            "reference": _clean_row_value(row.get("eight")),
            "methods": methods_list,
            "resources": resources_list,
            "assessment": _clean_row_value(row.get("eleven")),
            "remarks": _clean_row_value(row.get("twelve")),
            "non_teaching": _is_non_teaching_scheme_row(row),
        })

    return {
        "methods": methods,
        "assessment": assessment,
        "resources": resources,
        "references": references,
        "competences": competences,
        "rows": normalized,
    }