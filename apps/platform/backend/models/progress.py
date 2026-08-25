"""Persisted student progress/session records, synced from casuya-bridge."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class ProgressRecord(Base):
    __tablename__ = "progress_records"
    __table_args__ = (
        Index("ix_progress_student_id", "student_id"),
        Index("ix_progress_lesson_id", "lesson_id"),
        Index("ix_progress_synced_at", "synced_at"),
        UniqueConstraint("student_id", "lesson_id", name="uq_progress_student_lesson"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), nullable=False)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    score_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
