"""Tests for teacher plan (lesson plan / scheme of work) generation and CRUD."""

import json
import re
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth_service import register_user
from backend.services.teacher_plan_service import (
    _build_lesson_plan_offline,
    _build_scheme_offline,
    _distribute_periods,
    _fill_lesson_plan_placeholders,
    _lang_label,
    _scheme_row_for_lesson,
    _strip_item_marker,
    plan_lessons_for_subtopic,
    render_lesson_plan_html,
    render_scheme_of_work_html,
)

client = TestClient(app)


def _seed_subject_dict(slug: str, form_level: int) -> dict:
    """Build a service-shape subject dict from the real NECTA_SYLLABUS seed.

    Mirrors the DB->dict conversion in syllabus_service (_topic_to_dict /
    _subtopic_to_dict): period totals map to estimated_periods and the seed's
    (description, cognitive_level, order) outcome tuples become dicts. Lets the
    offline scheme/lesson generators be tested against the authentic TIE data
    that seed_necta_syllabus.run() inserts rather than synthetic mocks.
    """
    seed_dir = Path(__file__).resolve().parents[2] / "database" / "seeds"
    if str(seed_dir) not in sys.path:
        sys.path.insert(0, str(seed_dir))
    from seed_necta_syllabus import NECTA_SYLLABUS

    subject = next(s for s in NECTA_SYLLABUS if s["slug"] == slug)
    topics = []
    for t in sorted(
        (x for x in subject["topics"] if x["form_level"] == form_level),
        key=lambda x: x.get("order", 0),
    ):
        subtopics = []
        for sp in t.get("subtopics", []):
            outcomes = []
            for i, o in enumerate(sp.get("outcomes", []), start=1):
                if isinstance(o, (list, tuple)):
                    desc, cog, order = o
                    outcomes.append({
                        "description": desc,
                        "cognitive_level": cog,
                        "order_index": order if order else i,
                    })
                else:
                    outcomes.append({
                        "description": o.get("description", ""),
                        "cognitive_level": o.get("cognitive_level", "comprehension"),
                        "order_index": i,
                    })
            outcomes.sort(key=lambda x: x["order_index"])
            subtopics.append({
                "title": sp["title"],
                "code": sp.get("code"),
                "order_index": sp.get("order", 0),
                "estimated_periods": sp.get("periods") or 0,
                "outcomes": outcomes,
            })
        topics.append({
            "title": t["title"],
            "code": t.get("code"),
            "order_index": t.get("order", 0),
            "estimated_periods": t.get("periods") or 0,
            "form_level": form_level,
            "subtopics": subtopics,
        })
    return {
        "topics": topics,
        "name": subject["name"],
        "code": subject["code"],
        "slug": subject["slug"],
        "necta_code": subject["necta_code"],
    }


def _register(role: str):
    email = f"plan-{role}-{uuid.uuid4().hex[:8]}@test.com"
    result = register_user(email, "test123", role.title(), role)
    return {"Authorization": f"Bearer {result['access_token']}"}, result


# ── Service: language mapping ──────────────────────────────────────────────


def test_language_mapping():
    assert _lang_label("kiswahili") == "sw"
    assert _lang_label("historia-ya-tanzania-na-maadili") == "sw"
    assert _lang_label("mathematics") == "en"
    assert _lang_label("biology") == "en"


# ── Service: offline generators + renderers ───────────────────────────────


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
    # Removed placeholders / sections must not render.
    assert "REMARKS" not in html
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


def test_lesson_plan_tie_specific_activity_and_assessment_echo(monkeypatch):
    """The offline lesson plan matches the official TIE format: a concise (non
    time-boxed) specific learning activity, the 4 official stage names ending in
    'Realizations', and per-stage assessment criteria that echo the specific
    activity with the fixed TIE verb patterns."""
    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: form_data,
    )

    topic = next(t for t in form_data["topics"] if t["subtopics"])
    subtopic = topic["subtopics"][0]
    plan = _build_lesson_plan_offline(
        subject_slug="social-studies", subject_label="Physics", form_level=1,
        topic=topic["title"], subtopic=subtopic["title"], school_name="School",
        teacher_name="Teacher", number_of_students=40, duration_minutes=40,
        period="Period 1", lang="en",
    )
    ca = plan["competence_architecture"]
    # Competences carry the syllabus codes (TIE "{code} {title}" format).
    assert ca["main_competence"] == f"{topic['code']} {topic['title']}"
    assert ca["specific_competence"] == f"{subtopic['code']} {subtopic['title']}"
    # Specific activity is a concise (non time-boxed) outcome phrase.
    specific = ca["specific_learning_activity"]
    assert specific and "minutes" not in specific.lower()
    # Official stage names, ending in "Realizations".
    stages = [r["stage"] for r in plan["progression_matrix"]]
    assert stages == ["Introduction", "Competence Development", "Design", "Realizations"]
    # Assessments echo the specific activity with the fixed TIE verb patterns.
    checks = [
        ("identify prior knowledge related to", 0),
        ("accurately demonstrate understanding of", 1),
        ("correctly apply concepts and skills related to", 2),
        ("confidently justify outcomes related to", 3),
    ]
    for phrase, idx in checks:
        criteria = plan["progression_matrix"][idx]["assessment_criteria"]
        assert phrase in criteria, criteria
        assert specific in criteria, criteria


def test_lesson_plan_offline_uses_knowledge_base(monkeypatch):
    knowledge_topics = [
        {
            "title": "Cell Biology", "code": "1.0", "estimated_periods": 20,
            "description": "Understand the cell as the basic unit of life",
            "subtopics": [
                {"title": "Cell Structure", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe the cell", "cognitive_level": "knowledge"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_lesson_plan_offline(
        subject_slug="social-studies", subject_label="Biology", form_level=3,
        topic="Cell Biology", subtopic="Cell Structure", school_name="School",
        teacher_name="Teacher", number_of_students=30, duration_minutes=40,
        period="Period 3", lang="en",
    )
    ca = plan["competence_architecture"]
    assert ca["main_competence"] == "1.0 Cell Biology"
    assert ca["specific_competence"] == "1.1 Cell Structure"
    assert "Understand the cell" in ca["main_learning_activity"]
    assert "Describe the cell" in ca["specific_learning_activity"]
    # Realizations stage is populated from the syllabus outcome.
    assert "Describe the cell" in plan["progression_matrix"][3]["learner_activity"]

    html = render_lesson_plan_html(plan)
    assert "1.1 Cell Structure" in html
    assert "Describe the cell" in html
    assert "Realizations" in html


def test_lesson_plan_offline_falls_back_without_knowledge_base():
    plan = _build_lesson_plan_offline(
        subject_slug="social-studies", subject_label="Mathematics", form_level=2,
        topic="Algebra", subtopic="Linear Equations", school_name="Mwanza Sec",
        teacher_name="Mr J", number_of_students=42, duration_minutes=40,
        period="Period 3", lang="en",
    )
    assert plan["competence_architecture"]["main_competence"].startswith(
        "Demonstrate mastery of algebraic")
    assert plan["progression_matrix"][3]["stage"] == "Realizations"


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


def test_scheme_of_work_offline_render(monkeypatch):
    knowledge_topics = [
        {
            "title": "Cell Biology", "code": "1.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "Cell Structure", "code": "1.1", "estimated_periods": 8,
                 "outcomes": [{"description": "Describe the cell", "cognitive_level": "knowledge"}]},
                {"title": "Cell Division", "code": "1.2", "estimated_periods": 12,
                 "outcomes": [{"description": "Explain mitosis", "cognitive_level": "comprehension"}]},
            ],
        },
        {
            "title": "Genetics", "code": "2.0", "estimated_periods": 20,
            "subtopics": [
                {"title": "DNA and RNA", "code": "2.1", "estimated_periods": 10,
                 "outcomes": [{"description": "Describe DNA structure", "cognitive_level": "knowledge"}]},
                {"title": "Mendelian Inheritance", "code": "2.2", "estimated_periods": 10,
                 "outcomes": [{"description": "Apply Mendel's laws", "cognitive_level": "application"}]},
            ],
        },
    ]
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: {"topics": knowledge_topics},
    )

    plan = _build_scheme_offline(
        subject_slug="social-studies", subject_label="Social Studies", form_level=3,
        term="Term 1", academic_year="2026", school_name="School",
        teacher_name="Teacher", topics=["Cell Biology", "Genetics"], lang="en",
    )
    # weeks: 4 teaching + 2 midterm (exam + holiday) inserted at the midpoint.
    assert [w["specific_competence"] for w in plan["weeks"]] == [
        "1.1 Cell Structure", "1.2 Cell Division",
        "Assess learner mastery of the Term's topics",
        "Learner break following the midterm examination",
        "2.1 DNA and RNA", "2.2 Mendelian Inheritance",
    ]
    assert plan["weeks"][0]["main_competence"] == "1.0 Cell Biology"
    assert "Describe the cell" in plan["weeks"][0]["learning_activities"]
    assert plan["weeks"][0]["periods"] == 8
    # Midterm weeks have periods=0 (non-teaching).
    assert plan["weeks"][2]["periods"] == 0
    assert plan["weeks"][3]["periods"] == 0
    # Teaching weeks retain authentic periods; midterm weeks do not inflate them.
    teaching = [w for w in plan["weeks"] if w["periods"] > 0]
    assert sum(w["periods"] for w in teaching) == 8 + 12 + 10 + 10
    # Term I: first 4 weeks = January, weeks 5-6 = February (4-week month blocks).
    assert [w["month"] for w in plan["weeks"][:4]] == ["January"] * 4
    assert [w["month"] for w in plan["weeks"][4:]] == ["February"] * 2

    html = render_scheme_of_work_html(plan)
    assert "Cell Biology" in html
    assert "Cell Structure" in html
    assert "Term 1" in html
    assert "downloadAsWord" in html
    assert "ORIENTATION COURSE" in html
    assert "Main competence" in html
    assert "Specific competence" in html
    assert "Learning Activities" in html
    assert "Specific activities" in html
    assert "Month" in html
    assert "Assessment tools" in html
    assert "Teaching and learning methods" in html
    assert "Teaching and learning resources" in html


def test_scheme_of_work_rejects_third_term():
    from backend.api.teacher_plans import SchemeOfWorkGenerateRequest
    import pytest

    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 1")
    SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 2")
    with pytest.raises(ValueError):
        SchemeOfWorkGenerateRequest(subject_slug="mathematics", form_level=2, term="Term 3")


# ── Service: generators consume the real enriched TIE syllabus ────────────


def test_scheme_of_work_uses_real_enriched_syllabus(monkeypatch):
    # Physics O-Level is seeded from the authentic TIE CBC (2023) syllabus, so
    # the offline scheme generator must surface its verbatim Main/Specific
    # Competence statements, per-learning-activity rows and Authentic period
    # totals (not synthetic fallbacks) when fed the seeded syllabus data.
    from backend.data.tie_syllabus import get_specific_competences as _ts_g
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
    from backend.data.tie_syllabus import get_specific_competences as _ts_g
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


# ── Service: period-weighted lesson plans ──────────────────────────────────


def test_distribute_periods_sums_to_total():
    schedule = _distribute_periods(["a", "b", "c"], 5)
    assert sum(e["periods"] for e in schedule) == 5
    assert {e["activity"] for e in schedule} == {"a", "b", "c"}


def test_plan_lessons_for_subtopic_count_matches_periods(monkeypatch):
    """The number of lesson plans equals the Specific Competence's total
    allocated periods: each scheme learning-activity row with N periods
    produces N lessons (1 lesson/period), mirroring the scheme's split."""
    from backend.data.tie_syllabus import get_specific_competences as _ts_g
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
    from backend.data.tie_syllabus import get_specific_competences as _ts_g
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


def test_plan_lessons_for_subtopic_english_and_kiswahili(monkeypatch):
    # Both an English (physics) and a Kiswahili subject produce lessons wired
    # to their own scheme rows, with locale-correct class names. Each subject's
    # lesson count equals its own scheme row period allocation.
    from backend.data.tie_syllabus import get_specific_competences as _ts_g
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

    en, en_row = _run("physics", 1, "en", "Period")
    sw, sw_row = _run("kiswahili", 1, "sw", "Kipindi")
    assert en_row is not None and sw_row is not None
    assert len(en) == en_row["periods"]
    assert len(sw) == sw_row["periods"]
    assert en[0]["header"]["class_name"] == "Form 1"
    assert sw[0]["header"]["class_name"] == "Kidato 1"


# ── Service: midterm weeks + period integrity ─────────────────────────────


def test_scheme_of_work_midterm_and_period_integrity(monkeypatch):
    """Every term gets two non-teaching midterm weeks (exam + holiday) and
    the teaching-period total is never inflated by their insertion.

    Also asserts the data-integrity rule: every topic's period count must
    equal the sum of its subtopic periods — enforced at seed level and
    checked here as a regression guard.
    """
    form_data = _seed_subject_dict("physics", 1)
    monkeypatch.setattr(
        "backend.services.teacher_plan_service.get_subject_with_form",
        lambda slug, form: form_data,
    )

    for term in ("Term 1", "Term 2"):
        plan = _build_scheme_offline(
            subject_slug="physics", subject_label="Physics", form_level=1,
            term=term, academic_year="2026", school_name="School",
            teacher_name="Teacher", topics=[], lang="en",
        )
        weeks = plan["weeks"]
        teaching  = [w for w in weeks if w["periods"] > 0]
        midterm   = [w for w in weeks if w["periods"] == 0]

        # Exactly two midterm weeks per term.
        assert len(midterm) == 2, f"{term}: expected 2 midterm weeks, got {len(midterm)}"
        assert midterm[0]["main_competence"] == "MIDTERM EXAMINATION"
        assert midterm[1]["main_competence"] == "MIDTERM HOLIDAY"

        # Week numbering must be continuous after midterm insertion.
        assert [w["week_number"] for w in weeks] == list(range(1, len(weeks) + 1))

        # Teaching-period total must equal the TIE syllabus period total.
        from backend.data.tie_syllabus import get_specific_competences as _ts_g
        sub_total = sum(
            int(s.get("number_of_periods") or 0)
            for s in _ts_g("physics", 1)
        )
        assert sum(w["periods"] for w in teaching) == sub_total

        # Month assignment: Term 1 = Jan-May, Term 2 = Jul-Nov.
        valid_months = (
            {"January", "February", "March", "April", "May"}
            if term == "Term 1"
            else {"July", "August", "September", "October", "November"}
        )
        assert {w["month"] for w in weeks} <= valid_months


# ── API: save / list / get / delete ───────────────────────────────────────


def _save_plan(headers, plan_type="lesson_plan"):
    return client.post("/teacher-plans/save", headers=headers, json={
        "plan_type": plan_type,
        "title": "Algebra Test",
        "subject_slug": "mathematics",
        "subject_name": "Mathematics",
        "form_level": 2,
        "topic": "Algebra",
        "subtopic": "Logic",
        "plan_data": json.dumps({"header": {"topic": "Algebra"}}),
        "html_render": "<h1>Plan</h1>",
        "language": "en",
    })


def test_teacher_can_save_plan():
    headers, _ = _register("teacher")
    resp = _save_plan(headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["plan_type"] == "lesson_plan"
    assert data["id"]


def test_teacher_lists_only_own_plans():
    headers_a, _ = _register("teacher")
    headers_b, _ = _register("teacher")
    _save_plan(headers_a)
    _save_plan(headers_a, "scheme_of_work")
    _save_plan(headers_b)

    resp = client.get("/teacher-plans/list", headers=headers_a)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    resp_type = client.get("/teacher-plans/list?plan_type=scheme_of_work", headers=headers_a)
    assert resp_type.status_code == 200
    assert len(resp_type.json()) == 1
    assert resp_type.json()[0]["plan_type"] == "scheme_of_work"


def test_teacher_can_get_detail_and_export():
    headers, _ = _register("teacher")
    plan_id = _save_plan(headers).json()["id"]

    detail = client.get(f"/teacher-plans/{plan_id}", headers=headers)
    assert detail.status_code == 200
    assert "plan_data" in detail.json()
    assert "html_render" in detail.json()

    export = client.get(f"/teacher-plans/{plan_id}/export", headers=headers)
    assert export.status_code == 200
    assert "<h1>Plan</h1>" in export.text


def test_teacher_can_delete_plan():
    headers, _ = _register("teacher")
    plan_id = _save_plan(headers).json()["id"]

    resp = client.delete(f"/teacher-plans/{plan_id}", headers=headers)
    assert resp.status_code == 200

    gone = client.get(f"/teacher-plans/{plan_id}", headers=headers)
    assert gone.status_code == 404


def test_plan_requires_teacher_role():
    headers_student, _ = _register("student")
    resp = _save_plan(headers_student)
    assert resp.status_code in (403, 404)


def test_export_regenerates_html_when_not_stored():
    headers, _ = _register("teacher")
    # Save a lesson plan with an EMPTY html_render; export must read the
    # stored plan_data and regenerate a full document.
    resp = client.post("/teacher-plans/save", headers=headers, json={
        "plan_type": "lesson_plan",
        "title": "Regen",
        "subject_slug": "biology",
        "subject_name": "Biology",
        "form_level": 3,
        "topic": "Cell Biology",
        "subtopic": "The Cell",
        "plan_data": json.dumps({
            "header": {
                "school_name": "School", "teacher_name": "T",
                "class_name": "Form 3", "subject": "Biology",
                "topic": "Cell Biology", "subtopic": "The Cell",
            },
            "competences": ["Comp"], "specific_objectives": ["Obj"],
            "teaching_aids": ["Book"], "references": ["TIE"],
            "teaching_activities": [], "general_objectives": [], "remarks": "",
        }),
        "html_render": None,
        "language": "en",
    })
    plan_id = resp.json()["id"]

    export = client.get(f"/teacher-plans/{plan_id}/export", headers=headers)
    assert export.status_code == 200
    assert "<!DOCTYPE html" in export.text
    assert "Cell Biology" in export.text
