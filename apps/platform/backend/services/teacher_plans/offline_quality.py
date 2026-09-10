"""Shared quality/cell-standardization helpers and standardized scheme content
for the offline lesson-plan and scheme-of-work builders."""

from __future__ import annotations

import re

from .constants import _GENERIC_ASSESSMENT_PHRASES
from .utils import _activity_text, _as_text


def _polish_progression_cells(plan, lang):
    """Normalize progression table cells: flatten lists, trim whitespace, drop
    list markdown, and enforce sentence casing/punctuation. Pure formatting -
    never introduces content."""
    for stage in plan.get("progression_matrix") or []:
        if not isinstance(stage, dict):
            continue
        for key in ("stage", "core_content", "teacher_activity", "learner_activity", "assessment_criteria"):
            if key not in stage:
                continue
            text = _activity_text(stage.get(key))
            text = re.sub(r"[ \t\r\n\f\v]+", " ", text).strip()
            text = text.lstrip("-•*").strip()
            if text:
                if lang == "en" and text[0].islower():
                    text = text[0].upper() + text[1:]
                if key not in ("stage", "time") and not text.endswith(("!", ".", "?")):
                    text += "."
            stage[key] = text
    return plan


def _normalize_stage_times(plan, duration_minutes):
    """Reallocate the four progression stages to the official TIE time weights
    (Introduction 5 : Competence Development 15 : Design 12 : Realizations 8),
    scaled to the lesson duration - the pacing teachers expect from a TIE plan.
    No-op unless there are exactly four stages."""
    matrix = plan.get("progression_matrix") or []
    if len(matrix) != 4:
        return plan
    weights = [5, 15, 12, 8]
    total_w = sum(weights)
    times = [max(2, round(int(duration_minutes) * w / total_w)) for w in weights]
    times[1] += int(duration_minutes) - sum(times)
    for stage, minutes in zip(matrix, times):
        if isinstance(stage, dict):
            stage["time"] = f"{minutes} min"
    return plan


def _progression_quality_issues(plan, lang) -> list[str]:
    """Return a list of concrete, fixable quality problems in the progression
    table. Empty when every cell is meaningful, grammatical and stage-specific.
    The AI is asked to repair exactly these issues."""
    issues: list[str] = []
    matrix = plan.get("progression_matrix") or []
    if len(matrix) != 4:
        issues.append(f"Progression matrix has {len(matrix)} stages; exactly 4 TIE stages are required.")
    for i, stage in enumerate(matrix):
        if not isinstance(stage, dict):
            issues.append(f"Stage {i + 1} is not an object/provides no table row.")
            continue
        stage_name = _as_text(stage.get("stage")).strip() or f"stage {i + 1}"
        for key in ("teacher_activity", "learner_activity", "assessment_criteria"):
            text = _as_text(stage.get(key)).strip()
            label = f"{stage_name} - {key}"
            if not text:
                issues.append(f"{label} is missing/empty.")
                continue
            word_count = len(re.findall(r"\S+", text))
            min_words = 5 if key != "assessment_criteria" else 6
            if word_count < min_words:
                issues.append(f"{label} is too short ({word_count} words) - it must be a full sentence.")
            lowered = text.lower()
            if lowered.strip(" .:;,-\"'") in (stage_name.lower().strip(" ."), key.replace("_", " ")):
                issues.append(f"{label} merely repeats the cell label instead of describing real work.")
            if key == "assessment_criteria":
                if any(p in lowered for p in _GENERIC_ASSESSMENT_PHRASES):
                    issues.append(f"{label} is generic filler - it must evaluate the stage's teacher and learner activities.")
                if lang == "sw":
                    if "wanafunzi" not in lowered and "mwanafunzi" not in lowered:
                        issues.append(f"{label} does not state what learners must do (who does what).")
                elif not any(w in lowered for w in ("students", "learners", "learner", "pupils")) and "teacher" not in lowered:
                    issues.append(f"{label} does not state who does what (learners/teacher).")
            if "{" in text or "}" in text:
                issues.append(f"{label} contains unfilled placeholder tokens.")
    have_assess = [c.strip() for c in (_as_text(s.get("assessment_criteria")) for s in matrix if isinstance(s, dict)) if c]
    if len(set(have_assess)) != len(have_assess):
        issues.append("Assessment criteria repeat across different stages - each stage needs a unique criterion.")
    return issues


def _midterm_weeks(lang: str) -> list[dict]:
    """Two non-teaching scheme weeks inserted at each term's midpoint: the
    midterm examination and the midterm holiday (per official TIE schemes).
    periods=0 so they never alter the teaching-period total (which must equal
    the sum of subtopic periods)."""
    if lang == "sw":
        return [
            {
                "topic": "MTIHANI WA MUHULA",
                "subtopic": "Mtihani wa Muhula",
                "main_competence": "MTIHANI WA MUHULA",
                "specific_competence": "Kutathmini umahiri wa wanafunzi katika mada za muhula",
                "learning_activities": [
                    "Kufanya mtihani wa muhula",
                    "Kukagua majaribio na kujadili maendeleo ya wanafunzi",
                ],
                "specific_activities": "Mtihani wa kati wa muhula",
                "periods": 0,
                "reference": "TIE Syllabus",
                "teaching_methods": ["Mtihani wa mdomo", "Mtihani wa maandishi"],
                "teaching_resources": ["Karatasi za mitihani", "Vielelezo"],
                "assessment_tools": "Mtihani wa muhula",
                "remarks": "Andika maelezo ya utendaji wa wanafunzi",
                "teaching_aids": ["Kitabu", "Karatasi za mitihani"],
                "competences": ["MTIHANI WA MUHULA"],
                "objectives": ["Kufanya mtihani wa muhula"],
                "references": ["TIE Syllabus"],
                "assessment": "Mtihani wa muhula",
            },
            {
                "topic": "LIKIZO LA MUHULA",
                "subtopic": "Likizo ya Muhula",
                "main_competence": "LIKIZO LA MUHULA",
                "specific_competence": "Mapumziko ya wanafunzi kutokana na mtihani wa muhula",
                "learning_activities": [
                    "Wanafunzi wanapumzika na kufanya masomo ya nje ya darasa",
                ],
                "specific_activities": "Likizo ya kati ya muhula",
                "periods": 0,
                "reference": "TIE Syllabus",
                "teaching_methods": ["Kusoma binafsi"],
                "teaching_resources": ["Vitabu vya masomo"],
                "assessment_tools": "Hakuna tathmini rasmi",
                "remarks": "Rudi shuleni kwa muhula wa pili kwa tayari",
                "teaching_aids": ["Vitabu"],
                "competences": ["LIKIZO LA MUHULA"],
                "objectives": ["Likizo ya muhula"],
                "references": ["TIE Syllabus"],
                "assessment": "Hakuna",
            },
        ]
    return [
        {
            "topic": "MIDTERM EXAMINATION",
            "subtopic": "Midterm Examination",
            "main_competence": "MIDTERM EXAMINATION",
            "specific_competence": "Assess learner mastery of the Term's topics",
            "learning_activities": [
                "Sit for the midterm examination",
                "Review tests and discuss learner progress",
            ],
            "specific_activities": "Midterm assessment",
            "periods": 0,
            "reference": "TIE Syllabus",
            "teaching_methods": ["Oral assessment", "Written examination"],
            "teaching_resources": ["Examination papers", "Marking guides"],
            "assessment_tools": "Midterm examination",
            "remarks": "Record learner performance and plan remediation",
            "teaching_aids": ["Textbook", "Examination papers"],
            "competences": ["MIDTERM EXAMINATION"],
            "objectives": ["Sit for the midterm examination"],
            "references": ["TIE Syllabus"],
            "assessment": "Midterm examination",
        },
        {
            "topic": "MIDTERM HOLIDAY",
            "subtopic": "Midterm Holiday",
            "main_competence": "MIDTERM HOLIDAY",
            "specific_competence": "Learner break following the midterm examination",
            "learning_activities": [
                "Learners rest and undertake self-study during the break",
            ],
            "specific_activities": "Midterm break",
            "periods": 0,
            "reference": "TIE Syllabus",
            "teaching_methods": ["Independent study"],
            "teaching_resources": ["Learner books"],
            "assessment_tools": "No formal assessment",
            "remarks": "Resume refreshed for the second half of the term",
            "teaching_aids": ["Books"],
            "competences": ["MIDTERM HOLIDAY"],
            "objectives": ["Midterm holiday"],
            "references": ["TIE Syllabus"],
            "assessment": "None",
        },
    ]