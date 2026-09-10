"""Classroom connection endpoints.

Teacher creates their single class code (auto-generated on first access).
Students join by pasting/saving that code. Teachers see their connected
students; students see their connected teacher.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.classrooms import me, roster, student
from backend.api.classrooms.common import ClassroomCreateRequest, JoinClassroomRequest

router = APIRouter(prefix="/classrooms", tags=["classrooms"])

router.include_router(me.router)
router.include_router(roster.router)
router.include_router(student.router)

__all__ = ["router", "ClassroomCreateRequest", "JoinClassroomRequest"]
