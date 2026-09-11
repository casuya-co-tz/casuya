"""Tests for reference document mapping (pure functions)."""

from backend.services.reference_library_service import (
    map_form_level,
    map_subject_slug,
    parse_metadata,
)


def test_map_subject_slug_en_and_sw():
    assert map_subject_slug(None, "LESSON PLAN FOR MATHEMATICS FORM SIX") == "mathematics"
    assert map_subject_slug(None, "MPANGOKAZI WA HISABATI DARASA LA TANO") == "mathematics"
    assert map_subject_slug(None, "LESSON PLAN FOR ADVANCED MATHEMATICS") == "mathematics"
    assert map_subject_slug(None, "SCHEME OF WORK FOR BASIC MATHEMATICS FORM TWO") == "mathematics"
    assert map_subject_slug(None, "LESSON PLAN FOR CHEMISTRY FORM TWO") == "chemistry"
    assert map_subject_slug(None, "SCHEME KWA KEMIA DARASA LA NNE") == "chemistry"
    assert map_subject_slug(None, "LESSON PLAN FOR PHYSICS FORM ONE") == "physics"
    assert map_subject_slug(None, "SCHEME KWA FIZIKIA DARASA LA TANO") == "physics"


def test_map_subject_slug_removed_subjects_are_unmappable():
    assert map_subject_slug(None, "LESSON PLAN FOR BOOK-KEEPING FORM TWO") is None
    assert map_subject_slug(None, "SCHEME OF WORK FOR ACCOUNTANCY FORM FIVE") is None
    assert map_subject_slug(None, "LESSON PLAN FOR CIVICS AND MORAL EDUCATION") is None
    assert map_subject_slug(None, "SCHEME FOR URABIA NA MAADILI") is None
    assert map_subject_slug(None, "LESSON PLAN FOR BIBLE KNOWLEDGE FORM ONE") is None
    assert map_subject_slug(None, "SCHEME OF WORK FOR COMMERCE FORM ONE") is None
    assert map_subject_slug(None, "LESSON PLAN FOR AGRICULTURE") is None
    assert map_subject_slug(None, "LESSON PLAN FOR GEOGRAPHY FORM ONE") is None
    assert map_subject_slug(None, "LESSON PLAN FOR BIOLOGY FORM TWO") is None
    assert map_subject_slug(None, "LESSON PLAN FOR ENGLISH LANGUAGE") is None
    assert map_subject_slug(None, "LESSON PLAN FOR KISWAHILI FORM ONE") is None


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
    slug, form, name = parse_metadata("LESSON PLAN FOR PHYSICS FORM THREE", "Form 3")
    assert slug == "physics"
    assert form == 3
    assert name is not None and name.lower()