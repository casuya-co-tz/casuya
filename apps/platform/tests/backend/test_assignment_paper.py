"""Tests for assignment paper generation via NECTA presets."""

import pytest

from backend.services.exam_paper.assignment_paper import (
    assignment_presets,
    kind_to_test_type,
)
from backend.services.exam_paper.necta_presets import resolve_paper_preset
from backend.services.exam_paper.validator import validate_necta_paper


def test_kind_to_test_type_mapping():
    assert kind_to_test_type("exercise", 4) == "topical"
    assert kind_to_test_type("internal", 4) == "monthly"
    assert kind_to_test_type("necta", 2) == "necta_ii"
    assert kind_to_test_type("necta", 4) == "necta_iv"
    assert kind_to_test_type("necta", 6) == "necta_vi"


def test_assignment_presets_necta_mode():
    ctx = {
        "subject_slug": "physics",
        "form_level": 4,
        "lesson_title": "Force",
        "topic_title": "Mechanics",
    }
    cfg = assignment_presets(ctx, "necta")
    assert cfg["mode"] == "necta"
    assert cfg["papers"]
    assert cfg["papers"][0]["paper_code"] == "031/1"


@pytest.mark.asyncio
async def test_generate_assignment_paper_offline(monkeypatch):
    from backend.services.exam_paper.assignment_paper import generate_assignment_paper

    ctx = {
        "subject_slug": "physics",
        "subject_name": "Physics",
        "form_level": 4,
        "lesson_title": "Force",
        "topic_title": "Mechanics",
        "subtopic_title": "Newton Laws",
    }

    async def _fail_ai(*_args, **_kwargs):
        return None, {"source": "offline"}

    monkeypatch.setattr(
        "backend.services.ai_bridge.tests.generate_test_paper",
        _fail_ai,
    )

    preset = resolve_paper_preset("physics", 4, "topical", "theory")
    paper, generator, marking, valid, issues = await generate_assignment_paper(
        ctx, "exercise", paper="theory"
    )
    assert generator == "local"
    assert paper["sections"]
    assert valid, issues
    assert validate_necta_paper(paper, preset)[0]
