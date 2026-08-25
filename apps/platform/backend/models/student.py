"""Student profile, one-to-one with a User of role='student'."""

from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    form_level: Mapped[str | None] = mapped_column(String, nullable=True)  # I-VI
    school_code: Mapped[str | None] = mapped_column(String, nullable=True)
