"""Tests for the offline lesson plan builder (_build_lesson_plan_offline):
TIE format compliance render (English + Kiswahili) and placeholder filling.
"""

from backend.services.teacher_plan_service import (
    _build_lesson_plan_offline,
    _fill_lesson_plan_placeholders,
    render_lesson_plan_html,
)


def test_lesson_plan_offline_render_english():
    plan = _build_lesson_plan_offline(
        subject_slug="social-studies", subject_label="Mathematics", form_level=2,
        topic="Algebra", subtopic="Linear Equations", school_name="Mwanza Sec",
        teacher_name="Mr J", number_of_students=42, duration_minutes=40,
        period="Period 3", lang="en",
    )
    assert plan["header"]["school_name"] == "Mwanza Sec"
    assert plan["header"]["class_name"] == "Form 2"
    assert plan["header"]["students_registered"]["total"] == 42
    assert plan["header"]["students_registered"]["boys"] + plan["header"]["students_registered"]["girls"] == 42
    assert len(plan["progression_matrix"]) == 4
    assert plan["progression_matrix"][0]["stage"] == "Introduction"
    assert [r["stage"] for r in plan["progression_matrix"]] == [
        "Introduction", "Competence Development", "Design", "Realizations",
    ]
    assert "main_competence" in plan["competence_architecture"]
    assert plan["competence_architecture"]["specific_learning_activity"].startswith(
        "Define the key concepts of linear equations"
    )
    # stage times must sum to the duration
    total_time = sum(int(r["time"].split()[0]) for r in plan["progression_matrix"])
    assert total_time == 40

    html = render_lesson_plan_html(plan)
    assert "Linear Equations" in html
    assert "Form 2" in html
    assert "UNITED REPUBLIC OF TANZANIA" not in html
    assert "TANZANIA INSTITUTE OF EDUCATION" not in html
    assert "Competence Development" in html
    assert "Design" in html
    assert "Realizations" in html
    assert "Assessment Criteria" in html
    # Removed placeholders / sections must not render (the REMARKS/evaluation
    # section IS part of the current TIE render and stays).
    assert "REMARKS" in html
    assert "Indicate the percentage of students" not in html
    assert "LESSON OBJECTIVE" not in html
    assert "Learner Evaluation" not in html
    assert "Teacher Evaluation" not in html
    assert "Core Content" not in html
    assert "TO BE COMPLETED AFTER LESSON" not in html
    assert "1. CLASS INFORMATION" in html
    assert "2. MAIN COMPETENCE" in html
    assert "3. SPECIFIC COMPETENCE" in html
    assert "4. MAIN ACTIVITY" in html
    assert "5. SPECIFIC ACTIVITY" in html
    assert "6. TEACHING/LEARNING RESOURCE" in html
    assert "Learners" in html and "Activities" in html
    assert "LESSON PLAN NO." in html
    assert "downloadAsWord" not in html
    assert "window.print()" not in html


def test_fill_lesson_plan_placeholders_replaces_literal_tokens():
    plan = {
        "header": {"topic": "INDICES AND LOGARITHMS", "duration_minutes": 40},
        "competence_architecture": {
            "main_competence": "{topic_code} {topic_title}",
            "specific_competence": "{subtopic_code} {subtopic_title}",
            "lesson_objective": "By the end of this {duration}-minute lesson, the learner should be able to identify {topic_title} accurately.",
        },
        "resources_strategies": {
            "references": ["TIE (2026). {topic_title} for Secondary Schools Form 2, pp. 45-48. Dar es Salaam: TIE."]
        },
        "progression_matrix": [
            {"stage": "Introduction", "assessment_criteria": "Students identify prior knowledge related to {subtopic_title}."},
        ],
    }
    filled = _fill_lesson_plan_placeholders(
        plan,
        topic_code="1.1",
        topic_title="INDICES AND LOGARITHMS",
        sub_code="1.1.2",
        sub_title="Laws of Indices",
        duration_minutes=40,
    )
    assert filled["competence_architecture"]["main_competence"] == "1.1 INDICES AND LOGARITHMS"
    assert filled["competence_architecture"]["specific_competence"] == "1.1.2 Laws of Indices"
    assert "{topic_code}" not in filled["competence_architecture"]["main_competence"]
    assert "40-minute" in filled["competence_architecture"]["lesson_objective"]
    assert "{duration" not in filled["competence_architecture"]["lesson_objective"]
    assert "INDICES AND LOGARITHMS" in filled["resources_strategies"]["references"][0]
    assert filled["progression_matrix"][0]["assessment_criteria"].endswith(
        "related to Laws of Indices."
    )
    assert "{" not in filled["competence_architecture"]["main_competence"]
    assert "{" not in filled["competence_architecture"]["specific_competence"]
    assert "{" not in filled["competence_architecture"]["lesson_objective"]


def test_lesson_plan_offline_render_kiswahili():
    plan = _build_lesson_plan_offline(
        subject_slug="kiswahili", subject_label="Kiswahili", form_level=1,
        topic="Fasihi", subtopic="Methali", school_name="Shule", teacher_name="Bw J",
        number_of_students=30, duration_minutes=40, period="Kipindi 1", lang="sw",
    )
    assert len(plan["progression_matrix"]) == 4
    assert plan["progression_matrix"][0]["stage"] == "Utangulizi"
    # The specific activity is populated from the scheme (verbatim TIE syllabus).
    assert plan["competence_architecture"]["specific_learning_activity"]
    html = render_lesson_plan_html(plan)
    assert "Methali" in html
    assert "JAMHURI YA MUUNGANO WA TANZANIA" not in html
    assert "MPANGO WA SOMO LA MWALIMU" not in html
    assert "Ukuzaji wa Ujuzi" in html or "Kigezo cha Tathmini" in html
    assert "Kigezo cha Tathmini" in html or "Mpango wa Somo" in html