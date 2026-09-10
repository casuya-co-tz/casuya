"""Chemistry Form 1 lesson plan generator.

Builds the verified Chemistry Form One lesson plans JSON (20 lesson plans,
80-min double periods, 2 per week).

Run directly (`python generate_chem_f1_topics.py`) or via the thin wrapper
`generate_chem_f1.py`.
"""
import json
from pathlib import Path

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

from generate_chem_f1_topic_data import chem_lessons_data


chem_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in chem_lessons_data:
    chem_lessons.append({
        "title": f"CHEMISTRY FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
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

chem_doc = {
    "subject_name": "Chemistry",
    "subject_slug": "chemistry",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Chemistry Form One lesson plans (Arusha Catholic Seminary). 20 lesson plans (80 min double periods, 2 per week) covering Introduction to Chemistry (Week 1), Laboratory Rules and Safety (Week 2), First Aid & Apparatus (Week 3), Fire & Flames (Week 5), Flame Structure & Firefighting (Week 6), States of Matter (Week 7), Physical & Chemical Changes (Week 8), Elements & Symbols (Week 9), Compounds & Mixtures (Week 10), and Separating Mixtures (Week 11).",
    "lessons": chem_lessons
}


def generate():
    with open(REF_DIR / "chemistry_form_one.json", "w", encoding="utf-8") as f:
        json.dump(chem_doc, f, indent=2, ensure_ascii=False)
    print("Generated chemistry_form_one.json")


if __name__ == "__main__":
    generate()
