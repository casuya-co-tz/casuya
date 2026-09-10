"""Verbatim TIE CBC (2023) Main and Specific Competence statements.

Extracted manually from the official TIE "Mathematics Syllabus for Ordinary
Secondary Education" (Form I-IV) published at tie.go.tz.

Each platform teaching topic (old TIE 2005 content unit, e.g. "INDICES AND
LOGARITHMS") is mapped to the TIE 2023 CBC Main Competence and the Specific
Competence that covers that content. Both English ("en") and Kiswahili ("sw")
statements are provided.

Structure:
    TIE_COMPETENCES[subject_slug][form_level][topic_title_upper] =
        {"main_code": str, "main": {"en": str, "sw": str},
         "specific_code": str, "specific": {"en": str, "sw": str}}

Note: TIE reuses the same specific-competence numbering across forms, but the
Specific Competence *text* is form-specific, so entries are keyed by form too.
"""

from .mathematics_form1 import MATHEMATICS_FORM_1
from .mathematics_form2 import MATHEMATICS_FORM_2
from .mathematics_form3 import MATHEMATICS_FORM_3
from .mathematics_form4 import MATHEMATICS_FORM_4

TIE_MATHEMATICS = {
    1: MATHEMATICS_FORM_1,
    2: MATHEMATICS_FORM_2,
    3: MATHEMATICS_FORM_3,
    4: MATHEMATICS_FORM_4,
}

TIE_COMPETENCES = {
    "mathematics": TIE_MATHEMATICS,
}


def lookup_competence(subject_slug: str, form_level: int, topic_title: str):
    """Return the TIE competence record for a subject/form/topic, or None.

    Matching is case-insensitive on the topic title.
    """
    by_form = TIE_COMPETENCES.get((subject_slug or "").strip().lower())
    if not by_form:
        return None
    records = by_form.get(form_level)
    if not records:
        return None
    key = (topic_title or "").strip().upper()
    return records.get(key)