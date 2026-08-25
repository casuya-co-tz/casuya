"""History of packaged lesson versions. Casuya rule: never break existing
lesson packages on release — old versions stay retrievable here even
after a lesson is republished."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class LessonVersion(Base):
    __tablename__ = "lesson_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    package_version: Mapped[str] = mapped_column(String, nullable=False)
    content_hash: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    package_path: Mapped[str] = mapped_column(String, nullable=False)  # storage/lesson-packages/...
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
