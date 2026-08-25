"""Server-side lesson view activity tracking for streaks and stats."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class RecentActivity(Base):
    __tablename__ = "recent_activity"
    __table_args__ = (
        Index("ix_activity_student_id", "student_id"),
        Index("ix_activity_viewed_at", "viewed_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), nullable=False)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    lesson_title: Mapped[str] = mapped_column(String, default="")
    viewed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
