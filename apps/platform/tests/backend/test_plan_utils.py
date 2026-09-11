"""Tests for utility functions (and verbatim TIE competence / real syllabus).

Covers _lang_label, _distribute_periods, _tie_competences, per-learning-activity
lesson splitting (plan_lessons_for_subtopic / _scheme_row_for_lesson /
_strip_item_marker), verbatim TIE competence output from the offline builders,
and the real enriched TIE syllabus data.
"""

import re

from backend.data.tie_syllabus import get_specific_competences as _ts_g  # noqa: F401
from backend.services.teacher_plan_service import (
    _build_lesson_plan_offline,
    _build_scheme_offline,
    _distribute_periods,
    _lang_label,
    _scheme_row_for_lesson,
    _strip_item_marker,
    _tie_competences,
    plan_lessons_for_subtopic,
    render_lesson_plan_html,
)


def test_language_mapping():
    assert _lang_label("mathematics") == "en"
    assert _lang_label("chemistry") == "en"
    assert _lang_label("physics") == "en"


def test_distribute_periods_sums_to_total():
    schedule = _distribute_periods(["a", "b", "c"], 5)
    assert sum(e["periods"] for e in schedule) == 5
    assert {e["activity"] for e in schedule} == {"a", "b", "c"}


def test_lesson_plan_uses_verbatim_tie_competence():
    """The offline lesson plan surfaces the official TIE CBC (2023) Main and
    Specific Competence statements instead of the bare code + topic title."""
    for lang in ("en", "sw"):
        plan = _build_lesson_plan_offline(
            subject_slug="mathematics", subject_label="Basic Mathematics",
            form_level=2, topic="INDICES AND LOGARITHMS", subtopic="Laws of Indices",
            school_name="School", teacher_name="Teacher", number_of_students=40,
            duration_minutes=40, period="Period 1", lang=lang,
        )
        ca = plan["competence_architecture"]
        expected_main = (
            "2.0 Demonstrate mastery of basic concepts in geometry and algebra"
            if lang == "en" else
            "2.0 Kuonyesha ustadi wa dhana za msingi za jiometri na algebra"
        )
        expected_spec = (
            "2.2 Use algebra and matrices in problem solving"
            if lang == "en" else
            "2.2 Kutumia algebra na matriksi katika kutatua matatizo"
        )
        assert ca["main_competence"] == expected_main
        assert ca["specific_competence"] == expected_spec

    # HTML must show the verbatim competence and must NOT show a 'Topic:'/'Subtopic:' label.
    plan = _build_lesson_plan_offline(
        subject_slug="mathematics", subject_label="Basic Mathematics",
        form_level=2, topic="INDICES AND LOGARITHMS", subtopic="Laws of Indices",
        school_name="School", teacher_name="Teacher", number_of_students=40,
        duration_minutes=40, period="Period 1", lang="en",
    )
    html = render_lesson_plan_html(plan)
    assert "2.0 Demonstrate mastery of basic concepts in geometry and algebra" in html
    assert "2.2 Use algebra and matrices in problem solving" in html
    assert ">Topic:" not in html
    assert ">Subtopic:" not in html
    assert ">Topic</" not in html
    # The top info header must not repeat the specific competence; it belongs
    # only in the numbered "3. SPECIFIC COMPETENCE" section.
    top = html.split("1. CLASS INFORMATION")[0]
    assert "Specific competence" not in top
    assert "2.2 Use algebra and matrices" not in top


def test_tie_competences_chemistry_from_tie_syllabus():
    """Chemistry (absent from the curated topic map) resolves the verbatim TIE
    CBC competence from the full tie_syllabus dataset."""
    for lang in ("en", "sw"):
        main, spec = _tie_competences("chemistry", 2, "Atomic Structure", lang)
        assert main == "1.0 Demonstrate mastery of basic concepts, theories and principles in Chemistry"
        assert spec == "1.1 Demonstrate mastery of concepts, theories and principles in Chemistry"


def test_scheme_of_work_chemistry_uses_verbatim_tie_competence():
    """A Chemistry scheme-of-work (subject outside the curated map) uses the
    verbatim TIE competence from the tie_syllabus dataset, not topic titles."""
    plan = _build_scheme_offline(
        subject_slug="chemistry", subject_label="Chemistry", form_level=2,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["Atomic Structure"], lang="en",
    )
    rows = [w for w in plan["weeks"] if w["main_competence"].startswith("1.0")]
    assert rows
    assert rows[0]["main_competence"] == "1.0 Demonstrate mastery of basic concepts, theories and principles in Chemistry"
    assert rows[0]["specific_competence"] == "1.1 Demonstrate mastery of concepts, theories and principles in Chemistry"


def test_scheme_of_work_uses_verbatim_tie_competence():
    """The scheme-of-work week rows surface the verbatim TIE CBC competences."""
    plan = _build_scheme_offline(
        subject_slug="mathematics", subject_label="Basic Mathematics", form_level=2,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["INDICES AND LOGARITHMS"], lang="en",
    )
    rows = [w for w in plan["weeks"] if "2.2" in w["specific_competence"]]
    assert rows
    row = rows[0]
    assert row["main_competence"] == "2.0 Demonstrate mastery of basic concepts in geometry and algebra"
    assert row["specific_competence"] == "2.2 Use algebra and matrices in problem solving"


def test_scheme_of_work_uses_real_enriched_syllabus(monkeypatch):
    # Physics O-Level is seeded from the authentic TIE CBC (2023) syllabus, so
    # the offline scheme generator must surface its verbatim Main/Specific
    # Competence statements, per-learning-activity rows and Authentic period
    # totals (not synthetic fallbacks) when fed the seeded syllabus data.
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    specs = _ts_g("physics", 1)
    assert specs, "physics Form 1 syllabus must be seeded"

    plan = _build_scheme_offline(
        subject_slug="physics", subject_label="Physics", form_level=1,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=[], lang="en",
    )
    assert len(plan["weeks"]) > 0
    first_spec = specs[0]
    main_comp = f"{first_spec['main_code']} {first_spec['main_competence']}".strip()
    spec_comp = f"{first_spec['specific_code']} {first_spec['specific_competence']}".strip()

    teaching = [w for w in plan["weeks"] if w["periods"] > 0]
    midterm  = [w for w in plan["weeks"] if w["periods"] == 0]
    assert teaching[0]["main_competence"] == main_comp
    assert teaching[0]["specific_competence"] == spec_comp
    # A learning activity row is populated for the first specific competence.
    assert teaching[0]["learning_activities"], "weekly learning activities must be populated"
    # Term I only spans months January..May (4 weeks per month).
    assert {w["month"] for w in plan["weeks"]} <= {
        "January", "February", "March", "April", "May",
    }
    # Midterm weeks (periods=0) sit at the midpoint; teaching weeks carry the
    # authentic syllabus period totals and are never 0.
    assert len(midterm) == 2, "expect exactly midterm exam + midterm holiday"
    assert all(w["periods"] > 0 for w in teaching)
    # Teaching period total must equal the TIE syllabus period total (Physics F1).
    assert sum(w["periods"] for w in teaching) == sum(
        int(s.get("number_of_periods") or 0) for s in specs
    )


def test_lesson_plan_uses_real_enriched_syllabus(monkeypatch):
    # The lesson plan is wired to the Scheme-of-Work rows derived from the
    # authentic TIE CBC (2023) syllabus, so it must surface the verbatim
    # Main/Specific Competence statements, activity and citation for the
    # subject/form (not generic or KB-topics scaffolding).
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    specs = _ts_g("physics", 2)
    s = specs[0]
    main_comp = f"{s['main_code']} {s['main_competence']}".strip()
    spec_comp = f"{s['specific_code']} {s['specific_competence']}".strip()
    activity = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", (s["learning_activities"] or [""])[0]).strip()

    plan = _build_lesson_plan_offline(
        subject_slug="physics", subject_label="Physics", form_level=2,
        topic=s["specific_competence"], subtopic=activity, school_name="School",
        teacher_name="Teacher", number_of_students=40, duration_minutes=40,
        period="Period 1", lang="en",
    )
    ca = plan["competence_architecture"]
    # Verbatim TIE competences and a scheme-sourced activity.
    assert ca["main_competence"] == main_comp
    assert ca["specific_competence"] == spec_comp
    assert ca["main_learning_activity"]
    assert ca["specific_learning_activity"]
    # The reference cites the TIE student book like the scheme's Reference column.
    assert any("Physics Students Book Form 2" in r for r in plan["resources_strategies"]["references"])


def test_plan_lessons_for_subtopic_count_matches_periods(monkeypatch):
    """The number of lesson plans equals the Specific Competence's total
    allocated periods: each scheme learning-activity row with N periods
    produces N lessons (1 lesson/period), mirroring the scheme's split."""
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    s = _ts_g("physics", 1)[0]
    total_periods = int(s.get("number_of_periods") or 0)
    activities = [
        re.sub(r"^\s*\([a-zA-Z]\)\s*", "", a).strip()
        for a in (s.get("learning_activities") or [])
        if a and re.sub(r"^\s*\([a-zA-Z]\)\s*", "", a).strip()
    ]
    assert activities

    total = 0
    for activity in activities:
        lessons = plan_lessons_for_subtopic(
            subject_slug="physics", form_level=1,
            topic=s["specific_competence"], subtopic=activity,
            school_name="School", teacher_name="Teacher",
            number_of_students=40, duration_minutes=40, period="Period",
        )
        total += len(lessons)
        # Every lesson is a distinct, renderable plan focused on an activity.
        for lesson in lessons:
            assert lesson["header"]["subtopic"]
            assert len(lesson["progression_matrix"]) == 4
            assert render_lesson_plan_html(lesson)

    # One lesson per allocated period => total lessons == the competence's
    # total periods from the TIE syllabus.
    assert total == total_periods, (
        f"expected {total_periods} lessons, got {total}"
    )


def test_plan_lessons_grouped_by_learning_activity(monkeypatch):
    """Lessons for the same scheme learning-activity row carry a per-activity
    focus and a sequential (n/total) period label matching the scheme's period
    distribution over that row's specific activities."""
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    s = _ts_g("physics", 1)[0]
    activity = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", (s["learning_activities"] or [""])[0]).strip()
    row = _scheme_row_for_lesson("physics", 1, s["specific_competence"], activity, "en")
    assert row is not None
    row_periods = row["periods"]
    row_spec_acts = [_strip_item_marker(x) for x in (row["specific_activities"] or [])]
    row_spec_acts = [x for x in row_spec_acts if x]
    assert row_spec_acts

    lessons = plan_lessons_for_subtopic(
        subject_slug="physics", form_level=1,
        topic=s["specific_competence"], subtopic=activity,
        school_name="School", teacher_name="Teacher",
        number_of_students=40, duration_minutes=40, period="Period",
    )
    assert len(lessons) == row_periods
    # The first lesson targets the first specific activity; its period label
    # reflects the lesson's position within that activity's period group (weight).
    assert activity in lessons[0]["header"]["subtopic"]
    first_weight = next(
        e["periods"] for e in _distribute_periods(row_spec_acts, row_periods)
    )
    assert f"(1/{first_weight})" in lessons[0]["header"]["period"]


def test_plan_lessons_for_subtopic_across_subjects(monkeypatch):
    # Both Physics and Chemistry (English-medium) produce lessons wired to
    # their own scheme rows, with locale-correct class names. Each subject's
    # lesson count equals its own scheme row period allocation.
    from backend.services.teacher_plan_service import get_subject_with_form as _orig  # noqa: F401

    def _run(slug, form, lang, period):
        s = _ts_g(slug, form)[0]
        activity = re.sub(r"^\s*\([a-zA-Z]\)\s*", "", (s["learning_activities"] or [""])[0]).strip()
        row = _scheme_row_for_lesson(slug, form, s["specific_competence"], activity, lang)
        lessons = plan_lessons_for_subtopic(
            subject_slug=slug, form_level=form,
            topic=s["specific_competence"], subtopic=activity,
            school_name="School", teacher_name="Teacher",
            number_of_students=40, duration_minutes=40, period=period,
        )
        return lessons, row

    phy, phy_row = _run("physics", 1, "en", "Period")
    chem, chem_row = _run("chemistry", 1, "en", "Period")
    assert phy_row is not None and chem_row is not None
    assert len(phy) == phy_row["periods"]
    assert len(chem) == chem_row["periods"]
    assert phy[0]["header"]["class_name"] == "Form 1"
    assert chem[0]["header"]["class_name"] == "Form 1"
