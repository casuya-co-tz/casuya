"""AI prompt builders for lesson plans and schemes of work.

Facade keeping the original public surface: both builders were split into
``prompts_lesson`` and ``prompts_scheme``; everything that consumed
``backend.services.teacher_plans.prompts`` keeps importing from this module.
"""

from __future__ import annotations

from .prompts_lesson import _build_lesson_plan_prompt  # noqa: F401
from .prompts_scheme import _build_scheme_prompt  # noqa: F401