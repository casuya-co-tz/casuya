"""Exam paper generation — shared constants and label helpers."""

from __future__ import annotations

import re

KIND_LABELS = {
    "necta": "NECTA-STYLE EXAMINATION",
    "internal": "INTERNAL EXAMINATION",
    "exercise": "CLASS EXERCISE",
}

KIND_DURATION = {
    "necta": "2 Hours",
    "internal": "1 Hour 30 Minutes",
    "exercise": "40 Minutes",
}

SECTIONS_BY_KIND = {
    "necta": [
        {"id": "A", "title": "MULTIPLE CHOICE", "question_type": "mcq", "count": 20, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER / STRUCTURED", "question_type": "structured", "count": 6, "marks_per_question": 6},
        {"id": "C", "title": "ESSAY / PROBLEM SOLVING", "question_type": "essay", "count": 2, "marks_per_question": 22},
    ],
    "internal": [
        {"id": "A", "title": "OBJECTIVE QUESTIONS", "question_type": "mcq", "count": 10, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER QUESTIONS", "question_type": "structured", "count": 5, "marks_per_question": 4},
        {"id": "C", "title": "ESSAY QUESTION", "question_type": "essay", "count": 1, "marks_per_question": 10},
    ],
    "exercise": [
        {"id": "A", "title": "MULTIPLE CHOICE", "question_type": "mcq", "count": 5, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER", "question_type": "structured", "count": 3, "marks_per_question": 2},
        {"id": "C", "title": "WRITTEN RESPONSE", "question_type": "essay", "count": 1, "marks_per_question": 4},
    ],
}

_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}
_ROMAN_INT = {v: k for k, v in _ROMAN.items()}

_ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty"]


# ---------- form / label helpers ----------


def _form_level_int(form_level: str | int | None) -> int:
    if isinstance(form_level, bool):
        return 1
    if isinstance(form_level, int):
        return max(1, min(6, form_level))
    if not form_level:
        return 1
    s = str(form_level).strip()
    if s.isdigit():
        return max(1, min(6, int(s)))
    m = re.match(r"(?i)^form\s*(III|II|IV|VI|V|I)\b", s)
    if m:
        return _ROMAN_INT.get(m.group(1).upper(), 1)
    key = s.upper()
    return _ROMAN_INT.get(key, _ROMAN_INT.get(key.rstrip("."), 1))


def _format_form(form_level: int) -> str:
    return f"Form {_ROMAN.get(max(1, min(6, form_level)), 'I')}"


def _num_words(n: int) -> str:
    if n < 20:
        return _ONES[n] or str(n)
    t = n // 10
    if t >= 6:
        return str(n)
    return f"{_TENS[t]}-{_ONES[n % 10]}" if n % 10 else _TENS[t]


def _count_label(count: int) -> str:
    return f"{_num_words(count)} ({count}) questions"


def _mark_label(n: int) -> str:
    return f"{_num_words(n)} ({n}) mark{'s' if n != 1 else ''}"


def section_instruction(sec: dict) -> str:
    """Official-sounding instruction line mirroring how NECTA papers phrase it."""
    if sec.get("question_type") == "mcq":
        return (
            f"This section consists of {_count_label(sec['count'])}. "
            "Every question carries one (1) mark. Answer ALL questions."
        )
    return (
        f"This section consists of {_count_label(sec['count'])}. "
        f"Each question carries {_mark_label(sec['marks_per_question'])}. Answer ALL questions."
    )
