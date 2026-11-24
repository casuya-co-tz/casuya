"""Offline scheme-of-work generation tests.

Covers ``generate_scheme_of_work()``: the deterministic offline builder now
produces complete schemes of work with the offline source marker.
"""

import asyncio

from backend.services.teacher_plan_service import generate_scheme_of_work


def _run(coro):
    return asyncio.run(coro)


def test_scheme_of_work_offline_builds_complete_plan():
    """The deterministic offline builder returns a complete scheme of work."""
    plan, source = _run(generate_scheme_of_work(
        subject_slug="mathematics", form_level=1, term="Term 1",
        school_name="X", teacher_name="Y", topics=["Algebra"],
    ))
    assert source == "offline"
    assert "header" in plan
    assert "weeks" in plan
    assert len(plan["weeks"]) > 0
    assert plan["header"]["school_name"] == "X"


def test_scheme_of_work_offline_includes_midterm_weeks():
    """Every scheme carries the official non-teaching midterm weeks."""
    plan, source = _run(generate_scheme_of_work(
        subject_slug="mathematics", form_level=1, term="Term 1",
        school_name="X", teacher_name="Y", topics=["Algebra"],
    ))
    assert source == "offline"
    topics = [w.get("topic") for w in plan["weeks"]]
    assert any("MIDTERM" in str(t) for t in topics)
