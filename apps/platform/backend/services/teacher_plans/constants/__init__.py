"""Shared constants and string rules for teacher plan generation."""

from __future__ import annotations

from backend.services.teacher_plans.constants.misc import (
    MAX_PLAN_REPAIR_ATTEMPTS,
    _GENERIC_ASSESSMENT_PHRASES,
    _ROMAN,
)
from backend.services.teacher_plans.constants.plan_rules_en import (
    _TIE_LESSON_PLAN_RULES_EN,
    _TIE_SCHEME_RULES_EN,
)
from backend.services.teacher_plans.constants.plan_rules_sw import (
    _TIE_LESSON_PLAN_RULES_SW,
    _TIE_SCHEME_RULES_SW,
)

__all__ = [
    "MAX_PLAN_REPAIR_ATTEMPTS",
    "_GENERIC_ASSESSMENT_PHRASES",
    "_ROMAN",
    "_TIE_LESSON_PLAN_RULES_EN",
    "_TIE_LESSON_PLAN_RULES_SW",
    "_TIE_SCHEME_RULES_EN",
    "_TIE_SCHEME_RULES_SW",
]