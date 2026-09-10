"""Bilingual EN/SW text builders for the deterministic offline lesson plan.

Kept separate from ``offline_builder.py`` so the assembly function stays
within the per-file budget; the four texts below (lesson objective,
learner/teacher evaluation and remarks) are the longest string blocks.
"""

from __future__ import annotations


def lesson_objective_text(
    *, duration_minutes: int, specific_activity: str, lang: str,
) -> str:
    if lang == "en":
        return (
            f"By the end of this {duration_minutes}-minute lesson, "
            f"the learner should be able to demonstrate {specific_activity}"
        )
    return (
        f"Mwisho wa somo hili la dakika {duration_minutes}, "
        f"mwanafunzi anapaswa kuwa na uwezo wa kuonyesha {specific_activity}"
    )


def evaluation_learners_text(
    *, duration_minutes: int, specific_activity: str, total: int,
    boys: int, girls: int, lang: str,
) -> str:
    if lang == "en":
        return (
            f"By the end of the {duration_minutes}-minute lesson on {specific_activity}, "
            f"the teacher observes the {total} registered learners ({boys} boys, {girls} "
            f"girls). Learners demonstrate mastery of {specific_activity} through group "
            "tasks, oral questioning and exit-ticket responses; approximately 80% are "
            "expected to meet the specific competence, with remediation planned for those "
            "who require reinforcement."
        )
    return (
        f"Mwisho wa somo la dakika {duration_minutes} kuhusu {specific_activity}, "
        f"mwalimu huwachunguza wanafunzi {total} walioandikishwa ({boys} wavulana, "
        f"{girls} wasichana). Wanafunzi huonyesha umilisi wa {specific_activity} "
        "kupitia kazi za vikundi, maswali ya mdomo na majibu ya mwisho wa somo; "
        "takriban 80% wanatarajiwa kufikia ujuzi mahususi, na marekebisho "
        "yatafanywa kwa wanaohitaji kuimarishwa."
    )


def evaluation_teacher_text(
    *, subject_label: str, specific_activity: str, duration_minutes: int, lang: str,
) -> str:
    if lang == "en":
        return (
            f"Self-reflection: the teacher of {subject_label} for the lesson {specific_activity} "
            f"will note the effectiveness of the planned methods and resources in advancing "
            f"learners toward the specific competence. Any stage that required more than its "
            f"allocated time (per the {duration_minutes}-minute progression) is recorded so "
            "the plan can be adjusted for the next lesson."
        )
    return (
        f"Kujitathmini: mwalimu wa {subject_label} kwa somo {specific_activity} "
        f"ataandika ufanisi wa mbinu na rasilimali zilizopangwa katika kuwaendeleza "
        f"wanafunzi kuelekea ujuzi mahususi. Hatua yoyote iliyochukua muda zaidi ya "
        f"iliyopangwa (kwa muda wa dakika {duration_minutes}) itarekodiwa ili "
        "mpango urekebishwe kwa somo lijalo."
    )


def remarks_text(*, total: int, specific_activity: str, lang: str) -> str:
    if lang == "en":
        return (
            f"Record here the proportion of the {total} learners who achieved the specific "
            f"competence on {specific_activity}, the effectiveness of the teaching methods "
            "and resources, and any required remediation for the next lesson."
        )
    return (
        f"Andika hapa asilimia ya wanafunzi {total} waliofikia ujuzi mahususi wa "
        f"{specific_activity}, ufanisi wa mbinu na rasilimali za kufundisha, "
        "na marekebisho yanayohitajika kwa somo lijalo."
    )