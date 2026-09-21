"""Tests for the shared offline question bank (TS/Python parity)."""

from backend.services.exam_paper.local_paper import _norm_key, build_offline_paper
from backend.services.exam_paper.necta_presets import resolve_paper_preset
from backend.services.exam_paper.validator import validate_necta_paper


def _collect_text(paper: dict) -> str:
    out: list[str] = []
    for sec in paper["sections"]:
        for q in sec["questions"]:
            out.append(str(q.get("text") or ""))
            for p in q.get("parts") or []:
                out.append(str(p.get("text") or ""))
            for it in q.get("items") or []:
                out.append(str(it.get("text") or ""))
            out.extend(str(a) for a in q.get("listA") or [])
    return " ".join(out).lower()


def test_norm_key():
    assert _norm_key("Acids, Bases and Salts") == "acids bases and salts"
    assert _norm_key("NUMBERS") == "numbers"


def test_offline_math_topic_aware():
    preset = resolve_paper_preset("mathematics", 4, "topical", "theory")
    result = build_offline_paper(preset, subject_slug="mathematics", form_level=4, topics=["NUMBERS"])
    paper = result["paper"]
    valid, issues = validate_necta_paper(paper, preset)
    assert valid, issues
    text = _collect_text(paper)
    assert "question on " not in text
    assert any(k in text for k in ["order of operations", "market", "prices"])


def test_offline_math_no_generic_filler():
    preset = resolve_paper_preset("mathematics", 2, "topical", "theory")
    result = build_offline_paper(preset, subject_slug="mathematics", form_level=2, topics=["Numbers"])
    paper = result["paper"]
    text = _collect_text(paper)
    assert "question on " not in text
    assert any(k in text for k in ["order of operations", "prime factor", "market"])


def test_offline_spreads_topics():
    preset = resolve_paper_preset("physics", 4, "necta_iv", "theory")
    result = build_offline_paper(
        preset,
        subject_slug="physics",
        form_level=4,
        topics=["Force", "Energy", "Pressure", "Linear Motion"],
    )
    paper = result["paper"]
    valid, issues = validate_necta_paper(paper, preset)
    assert valid, issues
    text = _collect_text(paper)
    hits = [k for k in ["force", "energy", "pressure", "motion"] if k in text]
    assert len(hits) >= 2


def test_offline_physics_valid_and_non_placeholder():
    preset = resolve_paper_preset("physics", 4, "topical", "theory")
    result = build_offline_paper(preset, subject_slug="physics", form_level=4, topics=["Force"])
    paper = result["paper"]
    valid, issues = validate_necta_paper(paper, preset)
    assert valid, issues
    text = _collect_text(paper)
    assert "which statement about force is correct" not in text


def test_offline_chemistry_matching_preserved():
    preset = resolve_paper_preset("chemistry", 2, "necta_ii", "theory")
    result = build_offline_paper(preset, subject_slug="chemistry", form_level=2, topics=["Matter"])
    paper = result["paper"]
    valid, issues = validate_necta_paper(paper, preset)
    assert valid, issues
    match = next(q for s in paper["sections"] for q in s["questions"] if q["type"] == "matching")
    assert len(match["listA"]) == 5
    assert len(match["answers"]) == 5
    assert len(match["listB"]) >= 5
