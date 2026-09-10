"""Scaffold data for the offline lesson-plan builder.

Contains the deterministic TIE four-stage scaffolding (times, student counts,
stage names, teacher/learner activities, assessment, resources, references and
competence phrasing) used by ``offline_builder``. Kept separate so the builder
stays focused on the knowledge-base / scheme-row / reference grounding flow.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .utils import _time_to


def _build_stage_scaffold(
    *, lang, topic, subtopic_display, subject_label, form_level,
    number_of_students, students_boys=None, students_girls=None,
    duration_minutes,
) -> dict:
    # TIE 4-stage progression time allocation (Introduction/Competence
    # Development/Design/Realisation), scaled to the total duration.
    weights = [5, 15, 12, 8]
    total_w = sum(weights)
    times = [
        max(2, round(duration_minutes * w / total_w)) for w in weights
    ]
    # Absorb rounding drift into the Competence Development (longest) stage.
    drift = duration_minutes - sum(times)
    times[1] += drift
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    time_to = _time_to(duration_minutes)
    class_name = f"Form {form_level}" if lang == "en" else f"Kidato {form_level}"

    if students_boys is not None or students_girls is not None:
        half = number_of_students
        boys = students_boys if students_boys is not None else half - (students_girls or 0)
        girls = students_girls if students_girls is not None else half - boys
        total = boys + girls
    else:
        half = number_of_students // 2
        boys = number_of_students - half
        girls = half
        total = number_of_students

    if lang == "sw":
        stage_names = [
            "Utangulizi",
            "Ukuzaji wa Ujuzi",
            "Usanifu",
            "Utambuzi",
        ]
        teacher_acts = [
            f"Anawaonyesha wanafunzi hali/kauli rahisi kuhusu {topic} na kuwauliza kubainisha thamani zisizojulikana kwa kutumia viambishi/herufi.",
            f"Anawaongoza wanafunzi katika makundi kusoma muktadha wa {subtopic_display}, kuunda kauli za aljebra na kutatua hatua kwa hatua.",
            f"Anawapa wanafunzi matatizo ya muktadha na kuwaomba kuunda matatizo yao wenyewe ya {subtopic_display} ili kubadilishana na mwenzao.",
            f"Anawaongoza wanafunzi kufupisha kanuni kuu za {subtopic_display}, kutoa maswali ya kujiondoa (exit ticket) na kugawa kazi ya nyumbani.",
        ]
        learner_acts = [
            "Hutazama kadi za maneno, hujibu maswali ya mdomo na kutambua kiasi kisichojulikana kinachowakilishwa na viambishi.",
            "Katika makundi madogo, hujadili muktadha, hubadilisha maneno kuwa milinganyo na kukokotoa thamani ya kigezo kisichojulikana.",
            "Huunda matatizo binafsi, hubadilishana madaftari na wanafunzi wenzao na kutatua milinganyo zilizoundwa na wenzao.",
            "Hutaja mambo muhimu aliyojifunza, hukamilisha maswali ya kujiondoa binafsi na kuandika kazi ya nyumbani.",
        ]
        assessment = [
            "Wanafunzi hutambua vigezo visivyojulikana kwa usahihi kutoka kwenye kauli zilizopewa.",
            "Milinganyo huundwa na kutatuliwa kwa usahihi katika kazi za kikundi.",
            "Milinganyo iliyoundwa na wanafunzi wenzao imewekwa kwa usahihi na kuhesabiwa kwa usahihi.",
            "Maswali ya kujiondoa yamekamilishwa kwa usahihi kuonyesha umilisi wa dhana.",
        ]
        resources = [f"Kitabu cha somo cha {subject_label} (TIE)", "Ramani / michoro"]
        references = ["Misingumo ya TIE (Tanzania Institute of Education)"]
        environment = "Mpangilio wa makundi ya ushirikiano na vifaa vya kujifunzia vinavyofikiwa kwa urahisi"
        main_comp = f"Kuonyesha ustadi wa lugha ya hisabati na dhana za {topic}"
        spec_comp = f"Kutumia misemo ya aljebra na {subtopic_display} katika miktadha mbalimbali"
        main_act = f"Kuunda na kutatua {subtopic_display} kutokana na matatizo halisi ya maisha."
        spec_act = f"Fafanua dhana kuu za {subtopic_display} na kuzitumia katika miktadha halisi"
        fields = {
            "phase": "Hatua", "time": "Muda", "teacher_act": "Shughuli ya Mwalimu",
            "student_act": "Shughuli ya Mwanafunzi", "competency": "Ujuzi mkuu wa Karne ya 21",
            "assessment": "Kigezo cha Tathmini",
        }
    else:
        stage_names = [
            "Introduction",
            "Competence Development",
            "Design",
            "Realizations",
        ]
        teacher_acts = [
            "Displays word cards with simple arithmetic scenarios and prompts students to identify the unknown values using letters/variables.",
            f"Guides students in small groups to read given word scenarios on {subtopic_display}, form algebraic statements, and solve step-by-step on flip charts.",
            "Assigns individual contextual math problems and asks students to formulate their own word problems to exchange with a peer.",
            f"Guides students to summarise key rules of {subtopic_display}, provides exit ticket questions, and assigns homework exercises.",
        ]
        learner_acts = [
            "Observe the word cards, answer oral questions, and identify unknown quantities represented by variables.",
            "In small groups, discuss scenario cards, convert words into equations, and calculate the value of the unknown variable.",
            "Formulate individual word problems, exchange exercise books with peers, and solve peer-generated equations.",
            "State key learnings, complete exit ticket questions individually, and write down assigned homework.",
        ]
        assessment = [
            "Students identify unknown variables correctly from given statements.",
            "Equations correctly formulated and solved in group tasks.",
            "Peer-generated equations are correctly set up and accurately calculated.",
            "Exit tickets accurately completed showing mastery of the concept.",
        ]
        resources = [
            f"Flashcards with word problems on {topic}",
            "Realia (coins/market items)",
            f"Chart illustrating steps of {subtopic_display}",
            "Mathematics exercise books",
        ]
        references = [
            f"Tanzania Institute of Education (TIE). (2023). "
            f"Mathematics for Secondary Schools Student's Book {class_name}. "
            "TIE, Dar es Salaam."
        ]
        environment = "Collaborative group layout with accessible learning materials"
        main_comp = "Demonstrate mastery of algebraic concepts and logical reasoning in real-life problem solving"
        spec_comp = "Apply linear equations in one variable to solve everyday contextual problems"
        main_act = "Formulate and solve simple linear equations from contextual word problems"
        spec_act = "Define the key concepts of linear equations and apply them to everyday contextual problems"
        fields = {
            "phase": "Stage / Time", "time": "Time", "teacher_act": "Teacher Activity",
            "student_act": "Learner Activity", "competency": "21st-Century Core Competency",
            "assessment": "Assessment Criteria",
        }

    return {
        "times": times,
        "today": today,
        "time_to": time_to,
        "class_name": class_name,
        "boys": boys,
        "girls": girls,
        "total": total,
        "stage_names": stage_names,
        "teacher_acts": teacher_acts,
        "learner_acts": learner_acts,
        "assessment": assessment,
        "resources": resources,
        "references": references,
        "environment": environment,
        "main_comp": main_comp,
        "spec_comp": spec_comp,
        "main_act": main_act,
        "spec_act": spec_act,
        "fields": fields,
    }