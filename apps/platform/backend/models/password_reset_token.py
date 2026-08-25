"""Password reset token — short-lived, single-use token for forgot-password flow."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_generate_token)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    @staticmethod
    def create_for_user(user_id: str, ttl_minutes: int = 15) -> PasswordResetToken:
        return PasswordResetToken(
            user_id=user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        # DB drivers may strip timezone info — make both naive for comparison
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return now > expires
