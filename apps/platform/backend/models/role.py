"""Role catalog, separate from the simple User.role string column so
permissions can grow richer (e.g. per-school admin) without a migration
on the users table itself."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)  # student|teacher|admin|...
    description: Mapped[str | None] = mapped_column(String, nullable=True)
