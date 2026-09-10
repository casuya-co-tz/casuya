"""Password reset flows — forgot password and reset password."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.security import hash_password
from backend.config.settings import get_settings
from backend.models.password_reset_token import PasswordResetToken
from backend.models.user import User
from backend.services.email_service import send_password_reset_email, send_password_reset_sms

settings = get_settings()


def forgot_password(email: str | None = None, phone: str | None = None) -> dict:
    """Generate a password-reset token for the given email or phone number.

    Always returns a success response to prevent account enumeration.
    In development the token is also included in the response; in production it
    is delivered by email (Brevo SMTP/API) or SMS (Brevo transactional SMS)
    depending on which identifier was provided.
    """
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user: User | None = None
        if email:
            user = db.query(User).filter(User.email == email).first()
        elif phone:
            user = _find_user_by_phone(db, phone)

        if user and user.is_active:
            reset_token = PasswordResetToken.create_for_user(user.id)
            db.add(reset_token)
            db.commit()
            result: dict = {"message": "If that account is registered, a reset link has been sent."}
            if email:
                send_password_reset_email(email, reset_token.id)
            elif phone:
                send_password_reset_sms(user.phone or phone, reset_token.id)
            if settings.environment == "development":
                result["reset_token"] = reset_token.id
            return result
        # Always return the same message to avoid leaking which accounts exist.
        return {"message": "If that account is registered, a reset link has been sent."}
    except Exception:
        # Fail open — never reveal whether the account exists.
        return {"message": "If that account is registered, a reset link has been sent."}
    finally:
        _gen.close()


def _find_user_by_phone(db: Session, phone: str) -> User | None:
    """Find a user by phone, tolerant of common formatting differences.

    Phones stored as '+2557...'/'2557...'/'07...' all resolve to the same account.
    """
    clean = re.sub(r"\D", "", phone or "")
    if not clean:
        return None
    # Canonical E.164 national form (2557..., no leading sign)
    e164 = clean
    if e164.startswith("0"):
        e164 = "255" + e164[1:]
    elif len(e164) == 9:
        e164 = "255" + e164
    elif not e164.startswith("255"):
        e164 = "255" + e164
    candidates = [clean, e164, "+" + e164, "+" + clean]
    uniq = list(dict.fromkeys(candidates))
    return db.query(User).filter(User.phone.in_(uniq)).first()


def reset_password(token: str, new_password: str) -> dict:
    """Reset a user's password using a valid, unused token."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.id == token).first()
        if not reset_token:
            raise ValueError("Invalid or expired reset token")
        if reset_token.used:
            raise ValueError("Reset token has already been used")
        if reset_token.is_expired:
            raise ValueError("Reset token has expired")

        user = db.query(User).filter(User.id == reset_token.user_id).first()
        if not user or not user.is_active:
            raise ValueError("User account not found or is deactivated")

        user.hashed_password = hash_password(new_password)
        reset_token.used = True
        db.commit()
        return {"message": "Password has been reset successfully"}
    finally:
        _gen.close()