"""Donation / payment records (AzamPay)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    amount_tzs: Mapped[float] = mapped_column(Float, nullable=False)
    provider: Mapped[str] = mapped_column(String, default="azampay")
    provider_reference: Mapped[str | None] = mapped_column(String, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|success|failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
