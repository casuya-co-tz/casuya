"""Mathematics Form 1 lesson plan generator.

Builds the verified Basic Mathematics Form One lesson plans JSON (30 lesson
plans, 80-min double periods, 2 per week). Lesson-plan data lives in the
pure-data module `generate_math_f1_topic_data.py`.

Run directly (`python generate_math_f1_topics.py`) or via the thin wrapper
`generate_math_f1.py`.
"""
import json
from pathlib import Path

from generate_math_f1_topic_data import math_lessons_data

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

math_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in math_lessons_data:
    math_lessons.append({
        "title": f"MATHEMATICS FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
        "teaching_structure": [
            {
                "stage": st_name,
                "time": st_time,
                "teaching_activities": t_act,
                "learning_activities": l_act,
                "assessment_criteria": a_crit
            }
            for st_name, st_time, t_act, l_act, a_crit in stages
        ]
    })

math_doc = {
    "subject_name": "Mathematics",
    "subject_slug": "mathematics",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Basic Mathematics Form One lesson plans (Arusha Catholic Seminary). 30 lesson plans (80 min double periods, 2 per week) covering Term I (Concept of Mathematics, Numbers Classification, Real Numbers and Inequalities, Absolute Value, Approximation & Rounding, Significant Figures) and Term II (Ratios, Proportions, Algebraic Expressions, Linear Equations, Simultaneous Equations, Inequalities, Coordinate Geometry: Cartesian Plane, Gradient, Equation of Straight Line, Graphing Linear Equations).",
    "lessons": math_lessons
}


def generate():
    with open(REF_DIR / "mathematics_form_one.json", "w", encoding="utf-8") as f:
        json.dump(math_doc, f, indent=2, ensure_ascii=False)
    print("Generated mathematics_form_one.json")


if __name__ == "__main__":
    generate()