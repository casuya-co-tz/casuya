"""Tests for reference document mapping (pure functions)."""

from backend.services.reference_library_service import (
    map_form_level,
    map_subject_slug,
    parse_metadata,
)


def test_map_subject_slug_en_and_sw():
    assert map_subject_slug(None, "LESSON PLAN FOR MATHEMATICS FORM SIX") == "mathematics"
    assert map_subject_slug(None, "MPANGOKAZI WA HISABATI DARASA LA TANO") == "mathematics"
    assert map_subject_slug(None, "LESSON PLAN FOR BOOK-KEEPING FORM TWO") == "bookkeeping"
    assert map_subject_slug(None, "SCHEME OF WORK FOR ACCOUNTANCY FORM FIVE") == "bookkeeping"
    assert map_subject_slug(None, "LESSON PLAN FOR CIVICS AND MORAL EDUCATION") == "history_civics"
    assert map_subject_slug(None, "SCHEME FOR URABIA NA MAADILI") == "history_civics"
    assert map_subject_slug(None, "LESSON PLAN FOR BIBLE KNOWLEDGE FORM ONE") == "bible_knowledge"
    assert map_subject_slug(None, "LESSON PLAN FOR ADVANCED MATHEMATICS") == "additional_mathematics"
    assert map_subject_slug(None, "SCHEME OF WORK FOR COMMERCE FORM ONE") == "business_studies"
    assert map_subject_slug(None, "LESSON PLAN FOR AGRICULTURE") == "agriculture"


def test_map_subject_slug_unmappable():
    assert map_subject_slug(None, "LESSON PLAN FOR ECONOMICS FORM FIVE") is None
    assert map_subject_slug(None, "SCHEME FOR MUSIC") is None


def test_map_form_level():
    assert map_form_level("Form 2", "") == 2
    assert map_form_level("Standard 6", "") == 6
    assert map_form_level("", "KIDATO CHA TANO") == 5
    assert map_form_level("", "MPANGO KAZI WA SAYANSI DARASA LA NNE") == 4
    assert map_form_level("", "SCHEME OF WORK - STD 7") == 7
    assert map_form_level("unrelated", "no form mentioned") is None


def test_parse_metadata():
    slug, form, name = parse_metadata("LESSON PLAN FOR GEOGRAPHY FORM THREE", "Form 3")
    assert slug == "geography"
    assert form == 3
    assert name is not None and name.lower()
