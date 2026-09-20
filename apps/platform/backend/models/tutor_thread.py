from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class TutorThread(Base):
    """Server-side tutor conversation thread per user + lesson."""

    __tablename__ = "tutor_threads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    lesson_id: Mapped[str] = mapped_column(String, nullable=False)
    messages_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_tutor_thread_user_lesson"),
        Index("ix_tutor_thread_user", "user_id"),
        Index("ix_tutor_thread_lesson", "lesson_id"),
    )
