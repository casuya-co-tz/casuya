"""AI prompt builder for schemes of work (official TIE CBC format)."""

from __future__ import annotations

import json

from .constants import (
    _TIE_SCHEME_RULES_EN,
    _TIE_SCHEME_RULES_SW,
)
from .offline import _reference_scheme_grounding


def _build_scheme_prompt(
    *, lang, curriculum_ctx, subject_label, subject_slug, form_level, term, academic_year,
    school_name, teacher_name, topics,
) -> str:
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"
    topic_list = "\n".join(f"  - {t}" for t in topics) if topics else "  (Use curriculum context)"

    # A bundled, educator-verified scheme for this subject/form/term is fed to
    # the model as the authoritative content model (e.g. the Physics Form One
    # Term I/II schemes), reproduced verbatim rather than invented.
    scheme_block = ""
    _ref_scheme = _reference_scheme_grounding(subject_slug, form_level, term) if subject_slug else None
    if _ref_scheme and _ref_scheme.get("rows"):
        text_rows = []
        for r in _ref_scheme.get("rows") or []:
            if r.get("non_teaching"):
                continue
            text_rows.append(
                f"- {r.get('topic')} | Main comp: {r.get('main_competence')} | "
                f"Spec comp: {r.get('specific_competence')} | Activities: "
                f"{r.get('main_activity')} - {r.get('specific_activity')} | "
                f"Methods: {', '.join(r.get('methods') or [])} | "
                f"Resources: {', '.join(r.get('resources') or [])} | "
                f"Assessment: {r.get('assessment')} | Remarks: {r.get('remarks')}"
            )
        scheme_block = (
            "VERIFIED REFERENCE SCHEME OF WORK FOR THIS SUBJECT/FORM/TERM (official, "
            "educator-verified curriculum content - the authoritative model. Reproduce its "
            "per-week competences, activities, strategies/methods, resources, assessment "
            "tools and remarks verbatim; do not invent different ones):\n"
            + "\n".join(text_rows) + "\n"
        )

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
                "main_competence": "Main competence (e.g. 1.0 Demonstrate mastery...)",
                "specific_competence": "Specific competence (e.g. 1.1 Use numerical skills...)",
                "learning_activities": ["Learning activity (a), (b), ..."],
                "specific_activities": "Specific activity description",
                "month": "Month (e.g. February)",
                "week": "Week (e.g. Week 4)",
                "periods": 2,
                "reference": "Reference (e.g. TIE (2023) textbook, Dar es Salaam)",
                "teaching_methods": ["Jigsaw puzzle", "Brainstorming", "Group discussion"],
                "teaching_resources": ["Charts", "Real life objects", "Math Games"],
                "assessment_tools": "Assessment tools (e.g. Quizzes, questions and answers)",
                "remarks": "Remarks",
            }
        ],
    }

    if lang == "sw":
        return (
            "Unatengeneza Mpango wa Kazi wa Somo rasmi wa TIE kwa Misingumo ya Ujuzi.\n"
            "MUHIMU SANA: Toa JSON SAHIHI pekee — bila markdown, maelezo, au vizuizi vya msimbo.\n\n"
            f"MUUNDO:\n{json.dumps(json_schema, indent=2, ensure_ascii=False)}\n\n"
            f"MISEMBO YA MPANGO:\n{curriculum_ctx}\n\n"
            f"{scheme_block}\n"
            f"MADA ZINAZOHITAJIKA:\n{topic_list}\n\n"
            f"Tengeneza wiki zinazoshughulikia mada zote hapo juu. Kila wiki 3-5 vipindi.\n"
            "Kila wiki lazima iwe na: Ujuzi Mkuu, Ujuzi Mahususi, Shughuli za Kujifunza "
            "(a),(b),(c)...), Shughuli Mahususi, Mwezi, Wiki, Vipindi, Marejeo, Mbinu za "
            "Kufundisha na Kujifunza, Rasilimali za Kufundisha na Kujifunza, Zana za Tathmini, na Maelezo.\n"
            f"{_TIE_SCHEME_RULES_SW}\n"
            f"Lugha: Kiswahili"
        )

    return (
        "You are generating an official TIE Competence-Based Scheme of Work.\n"
        "CRITICAL: Output ONLY valid JSON matching this schema.\n\n"
        f"JSON SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
        f"CURRICULUM CONTEXT:\n{curriculum_ctx}\n\n"
        f"{scheme_block}\n"
        f"TOPICS TO COVER:\n{topic_list}\n\n"
        "Generate weeks covering ALL topics listed above. Each week: 3-5 periods, one subtopic.\n"
        "Each week MUST include: Main competence, Specific competence, Learning activities "
        "((a),(b),(c)...), Specific activities, Month, Week, Periods, Reference, Teaching and "
        "learning methods, Teaching and learning resources, Assessment tools, and Remarks.\n"
        f"{_TIE_SCHEME_RULES_EN}\n"
        f"Language: English"
    )