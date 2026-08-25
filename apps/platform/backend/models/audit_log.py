"""Append-only record of sensitive actions (publish lesson, change role,
refund payment, ...) for accountability. Never update or delete rows here."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "lesson.publish"
    target_type: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "lesson"
    target_id: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
