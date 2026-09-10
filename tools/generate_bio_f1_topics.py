"""Biology Form 1 lesson plan generator.

Builds the verified Biology Form One lesson plans JSON (30 lesson plans,
80-min double periods, 2 per week). Lesson-plan data lives in the pure-data
module `generate_bio_f1_topic_data.py`.

Run directly (`python generate_bio_f1_topics.py`) or via the thin wrapper
`generate_bio_f1.py`.
"""
import json
from pathlib import Path

from generate_bio_f1_topic_data import bio_lessons_data

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

bio_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in bio_lessons_data:
    bio_lessons.append({
        "title": f"BIOLOGY FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
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

bio_doc = {
    "subject_name": "Biology",
    "subject_slug": "biology",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Biology Form One lesson plans (Arusha Catholic Seminary). 30 lesson plans (80 min double periods, 2 per week) covering Term I (Introduction to Biology, Laboratory Apparatus & Scientific Skills, Scientific Method & Experiments, The Cell, Types of Cells, Cell Organization) and Term II (Concept & Systems of Classification, Major Groups & Binomial Nomenclature, Viruses & Kingdom Monera, Kingdoms Protoctista & Fungi, Kingdom Plantae & Angiospermophyta, Kingdom Animalia, Nutrition & Elements in Plants, Photosynthesis, Leaf Structure & Importance).",
    "lessons": bio_lessons
}


def generate():
    with open(REF_DIR / "biology_form_one.json", "w", encoding="utf-8") as f:
        json.dump(bio_doc, f, indent=2, ensure_ascii=False)
    print("Generated biology_form_one.json")


if __name__ == "__main__":
    generate()