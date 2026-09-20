"""Tests for NECTA tutoring format scoring and post-processing."""

from backend.services.ai_bridge.prompts import (
    _append_thread_context,
    _clean_tutor_response,
    _score_necta_format,
    _tutoring_result_from_ai,
)


def test_score_necta_format_complete():
    text = (
        "> 🌍 Context: Form II Chemistry\n"
        "### Step 1\n"
        "💡 **NECTA Examination Tip**\n"
        "**Review Question (Form II CSEE):** What is pH?"
    )
    assert _score_necta_format(text) == "complete"


def test_score_necta_format_partial():
    text = "### Step 1\nSome explanation without NECTA tip."
    assert _score_necta_format(text) == "partial"


def test_tutoring_result_from_ai_preserves_format_fields():
    parsed = _tutoring_result_from_ai({
        "response": "> 🌍 Context\n### Step\n💡 NECTA Examination Tip\n**Review Question:** Q?",
        "sourced": True,
        "kbHits": [{"title": "Paper", "kind": "exam"}],
        "formatComplete": True,
        "formatLevel": "complete",
        "questions": [],
    })
    assert parsed is not None
    assert parsed["formatComplete"] is True
    assert parsed["formatLevel"] == "complete"
    assert parsed["kbHits"][0]["title"] == "Paper"


def test_append_thread_context_merges_messages():
    merged = _append_thread_context(
        "Lesson: Algebra",
        [
            {"role": "user", "text": "What is x?"},
            {"role": "tutor", "text": "x is the unknown."},
        ],
    )
    assert "Lesson: Algebra" in merged
    assert "Student: What is x?" in merged
    assert "Tutor: x is the unknown." in merged


def test_clean_tutor_response_strips_think_tags():
    think_close = "<" + "/think>"
    raw = f"before thinking\ninternal reasoning\n{think_close}\n\n> 🌍 Context\nAnswer"
    cleaned = _clean_tutor_response(raw)
    assert "internal reasoning" not in cleaned
    assert "Context" in cleaned
