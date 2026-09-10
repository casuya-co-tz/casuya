"""Teacher plan endpoints — generate, save, list, export lesson plans and schemes of work."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.teacher_plans import crud, generate
from backend.api.teacher_plans.models import (
    LessonPlanGenerateRequest,
    LessonPlansGenerateRequest,
    PlanSaveRequest,
    SchemeOfWorkGenerateRequest,
)

router = APIRouter(prefix="/teacher-plans", tags=["teacher-plans"])

router.include_router(generate.router)
router.include_router(crud.router)

__all__ = [
    "router",
    "LessonPlanGenerateRequest",
    "LessonPlansGenerateRequest",
    "SchemeOfWorkGenerateRequest",
    "PlanSaveRequest",
]
