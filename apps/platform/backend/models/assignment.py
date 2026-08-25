"""Assignments: teachers assign lessons to students with due dates and blackboard grading."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("assignments.id"), nullable=False)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), nullable=False)
    elements_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    grade_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
