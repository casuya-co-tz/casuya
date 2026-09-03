"""Tests for the full TIE CBC (2023) syllabus dataset loader."""

import pytest

from backend.data import tie_syllabus as ts


def test_all_subjects_load():
    for slug in ts.SUBJECT_SLUG_FILES:
        doc = ts.get_subject(slug)
        assert doc is not None, slug
        assert doc["subject"] == slug
        assert doc["language"] in ("en", "sw")
        assert doc["forms"], slug


def test_maths_all_four_forms_populated():
    assert ts.list_forms("mathematics") == ["1", "2", "3", "4"]
    for form in ("1", "2", "3", "4"):
        recs = ts.get_specific_competences("mathematics", int(form))
        assert recs, f"form {form} empty"


def test_maths_form2_indices_maps_to_algebra_specific():
    """'INDICES AND LOGARITHMS' (Form 2) must resolve to the specific
    competence covering algebra/matrices, matching the app's topic."""
    rec = ts.find_by_keyword("mathematics", 2, "INDICES AND LOGARITHMS")
    assert rec is not None
    assert rec["specific_competence"] == "Use algebra and matrices in problem solving"


def test_specific_competence_record_has_all_seven_columns():
    rec = ts.find_by_keyword("mathematics", 2, "INDICES AND LOGARITHMS")
    assert rec is not None
    assert rec["main_code"]
    assert rec["main_competence"]
    assert rec["specific_code"]
    assert rec["specific_competence"]
    assert rec["number_of_periods"]
    assert rec["learning_activities"]
    assert rec["teaching_methods"]
    assert rec["assessment_criteria"]
    assert rec["resources"]


def test_lookup_competence_by_text():
    rec = ts.lookup_competence("mathematics", 2, "algebra and matrices")
    assert rec is not None
    assert rec["specific_competence"] == "Use algebra and matrices in problem solving"


def test_unknown_subject_and_form_return_empty():
    assert ts.get_subject("not_a_subject") is None
    assert ts.get_specific_competences("mathematics", 99) == []


def test_slugs_and_aliases():
    assert ts._canonical_slug("math") == "mathematics"
    assert ts._canonical_slug("civics") == "history_civics"
    assert ts._canonical_slug("Basic-Mathematics") == "mathematics"


def test_kiswahili_language_syllabi_marked_sw():
    for slug in ("kiswahili", "history_civics"):
        assert ts.get_subject(slug)["language"] == "sw"
