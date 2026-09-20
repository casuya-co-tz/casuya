from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class TutorReviewItem(Base):
    """Flagged AI tutor answers awaiting teacher/admin review."""

    __tablename__ = "tutor_review_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    lesson_id: Mapped[str | None] = mapped_column(String, nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    subject_slug: Mapped[str | None] = mapped_column(String, nullable=True)
    format_level: Mapped[str] = mapped_column(String, default="none")
    flagged_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String, default="casuya-ai")
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | approved | dismissed
    reviewer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_tutor_review_status", "status"),
        Index("ix_tutor_review_created", "created_at"),
    )
