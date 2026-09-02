"""Saved lesson plans and schemes of work for teachers.

Stores AI-generated TIE-format teaching documents as structured JSON,
with pre-rendered HTML for print/PDF/Word export.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class TeacherPlan(Base):
    __tablename__ = "teacher_plans"
    __table_args__ = (Index("ix_teacher_plan_teacher", "teacher_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teachers.id"), index=True, nullable=False)
    plan_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subject_slug: Mapped[str] = mapped_column(String, nullable=False)
    subject_name: Mapped[str | None] = mapped_column(String, nullable=True)
    form_level: Mapped[int] = mapped_column(nullable=False)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    subtopic: Mapped[str | None] = mapped_column(String, nullable=True)
    term: Mapped[str | None] = mapped_column(String, nullable=True)
    plan_data: Mapped[str] = mapped_column(Text, nullable=False)
    html_render: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String, default="en")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
