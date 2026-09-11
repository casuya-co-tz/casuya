"""Reference library — subject / form-level mapping helpers.

Best-effort mapping of raw reference-document metadata (title / standard) onto
Casuya's ``subject_slug`` + ``form_level``.
"""

from __future__ import annotations

import re

# Keyword -> Casuya subject_slug mapping (best-effort). Ordered so more
# specific phrases (e.g. "advanced mathematics") match before generic ones.
_SUBJECT_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"basic\s*mathematics|mathematics|mathemat|hisabati|kuhesabu|numeracy|\bmath\b"), "mathematics"),
    (re.compile(r"chemistry|\bkemia\b"), "chemistry"),
    (re.compile(r"physics|\bfizikia\b"), "physics"),
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


def _rule_match(text: str) -> str | None:
    """Return the first registered subject slug found anywhere in ``text``."""
    lowered = text.lower()
    for pattern, slug in _SUBJECT_RULES:
        if pattern.search(lowered):
            return slug
    return None


def _header(text: str) -> str:
    """Leading title header (text before the first ':') — where the actual
    subject normally lives, e.g. 'PHYSICS FORM ONE LESSON PLAN NO. 1'."""
    return text.split(":", 1)[0]


def map_subject_slug(raw_subject_name: str | None, title: str) -> str | None:
    """Best-effort map a raw subject name / reference title to a Casuya slug.

    A subject keyword in the leading header wins: a title like
    'PHYSICS ... LESSON PLAN NO. 1: CONCEPT OF PHYSICS' is a Physics
    lesson (header) even though its topic text mentions physics. Falls
    back to scanning the full text when the header carries no subject."""
    text = " ".join(x for x in [raw_subject_name, title] if x)
    return _rule_match(_header(text)) or _rule_match(text)


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
    # Prefer the leading header (text before the first ':'), like the slug
    # mapper, so topic text mentioning another subject can't hijack the name.
    candidates = [lowered.split(":", 1)[0], lowered]
    for text in candidates:
        for pattern, _ in _SUBJECT_RULES:
            m = pattern.search(text)
            if m:
                # Map back to the original (case-preserved) title text.
                start = title.lower().find(text[m.start():m.end()])
                if start >= 0:
                    return title[start:start + len(text[m.start():m.end()])].strip()
                return title[m.start():m.end()].strip()
    return None


def parse_metadata(title: str, standard: str | None) -> tuple[str | None, int | None, str | None]:
    """Return ``(subject_slug, form_level, subject_name)`` for a reference doc."""
    return (
        map_subject_slug(None, title),
        map_form_level(standard, title),
        _subject_name_from_title(title),
    )
