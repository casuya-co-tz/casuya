"""Aggregated, precomputed analytics snapshots (refreshed by
tasks/reports.py) to keep dashboard queries cheap."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class LessonAnalyticsSnapshot(Base):
    __tablename__ = "lesson_analytics_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    session_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_completion_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    avg_score_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
