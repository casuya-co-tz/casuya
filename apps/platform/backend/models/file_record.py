from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class FileRecord(Base):
    __tablename__ = "file_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
