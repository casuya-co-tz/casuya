"""Tests for NECTA paper preset resolver."""

from backend.services.exam_paper.local_paper import build_offline_paper
from backend.services.exam_paper.necta_presets import (
    form_family,
    list_available_papers,
    resolve_paper_preset,
)
from backend.services.exam_paper.validator import validate_necta_paper


def test_form_family():
    assert form_family(2) == "ftna"
    assert form_family(4) == "csee"
    assert form_family(6) == "acsee"


def test_csee_physics_theory_structure():
    preset = resolve_paper_preset("physics", 4, "necta_iv", "theory")
    assert preset is not None
    assert preset["subject_code"] == "031"
    assert preset["paper_code"] == "031/1"
    slots = [q for s in preset["sections"] for q in s["questions"]]
    assert len(slots) == 11
    assert slots[1]["type"] == "matching"
    assert slots[1]["item_count"] == 6


def test_ftna_matching_five_items():
    preset = resolve_paper_preset("chemistry", 2, "necta_ii", "theory")
    matching = next(q for s in preset["sections"] for q in s["questions"] if q["type"] == "matching")
    assert matching["item_count"] == 5


def test_mathematics_no_practical_preset():
    papers = list_available_papers("mathematics", 4, "midterm")
    assert not any(p["paper"] == "practical" for p in papers)


def test_offline_paper_has_sections():
    preset = resolve_paper_preset("physics", 4, "topical", "theory")
    result = build_offline_paper(preset, subject_slug="physics", form_level=4, topics=["Force"])
    paper = result["paper"]
    assert paper["header"]["subject_code"] == "031"
    assert paper["sections"]
    assert paper["header"]["total_marks"] > 0
    assert result["markingScheme"]["sections"]


def test_validate_necta_offline_paper():
    preset = resolve_paper_preset("physics", 4, "necta_iv", "theory")
    result = build_offline_paper(preset, subject_slug="physics", form_level=4, topics=["Force"])
    valid, issues = validate_necta_paper(result["paper"], preset)
    assert valid, issues


def test_validate_necta_rejects_bad_mcq_count():
    preset = resolve_paper_preset("physics", 4, "necta_iv", "theory")
    result = build_offline_paper(preset, subject_slug="physics", form_level=4, topics=["Force"])
    paper = result["paper"]
    for q in paper["sections"][0]["questions"]:
        if q.get("type") == "mcq_bundle":
            q["items"] = q["items"][:5]
            break
    valid, issues = validate_necta_paper(paper, preset)
    assert not valid
    assert any("mcq_bundle" in i for i in issues)
