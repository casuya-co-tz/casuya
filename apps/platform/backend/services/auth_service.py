from __future__ import annotations

import secrets

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from backend.config.settings import get_settings
from backend.models.password_reset_token import PasswordResetToken
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User

settings = get_settings()


def _dev_token_response(email: str, role: str | None = None) -> dict:
    """Generate a real JWT for a mock dev user when the database is unavailable."""
    if not role:
        if "admin" in email.lower():
            role = "admin"
        elif "teacher" in email.lower():
            role = "teacher"
        else:
            role = "student"
    user_id = f"dev-{email.split('@')[0]}"
    access_token = create_access_token(user_id, extra_claims={"role": role})
    refresh_token = create_refresh_token(user_id, role=role)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user_id,
        "role": role,
    }


def register_user(email: str, password: str, full_name: str, role: str = "student", phone: str | None = None) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        if db.query(User).filter(User.email == email).first():
            raise ValueError("Email already registered")
        if phone and db.query(User).filter(User.phone == phone).first():
            raise ValueError("Phone already registered")
        user = User(
            email=email,
            phone=phone,
            hashed_password=hash_password(password),
            role=role,
        )
        db.add(user)
        db.flush()
        if role == "student":
            profile = Student(user_id=user.id, full_name=full_name)
            db.add(profile)
        elif role == "teacher":
            profile = Teacher(user_id=user.id, full_name=full_name)
            db.add(profile)
        db.commit()
        access_token = create_access_token(user.id, extra_claims={"role": role})
        refresh_token = create_refresh_token(user.id, role=role)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": role,
        }
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            return _dev_token_response(email, role)
        raise
    finally:
        _gen.close()


def authenticate_user(email: str, password: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is deactivated")
        access_token = create_access_token(user.id, extra_claims={"role": user.role})
        refresh_token = create_refresh_token(user.id, role=user.role)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": user.role,
        }
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            return _dev_token_response(email)
        raise
    finally:
        _gen.close()


def refresh_access_token(refresh_token: str) -> dict:
    payload = decode_refresh_token(refresh_token)
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if not user or not user.is_active:
            raise ValueError("Invalid or deactivated user")
        access_token = create_access_token(user.id, extra_claims={"role": user.role})
        return {"access_token": access_token, "token_type": "bearer"}
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            # DB unavailable: preserve the role embedded in the refresh token
            # so admins/teachers are not downgraded to students on refresh.
            role = payload.get("role") or "student"
            access_token = create_access_token(payload["sub"], extra_claims={"role": role})
            return {"access_token": access_token, "token_type": "bearer"}
        raise
    finally:
        _gen.close()


def forgot_password(email: str) -> dict:
    """Generate a password-reset token for the given email.

    Always returns a success response to prevent email enumeration.
    In development the token is included in the response; in production
    it would be sent via email.
    """
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.email == email).first()
        if user and user.is_active:
            reset_token = PasswordResetToken.create_for_user(user.id)
            db.add(reset_token)
            db.commit()
            result: dict = {"message": "If that email is registered, a reset link has been sent."}
            if settings.environment == "development":
                result["reset_token"] = reset_token.id
            return result
        # Always return the same message to avoid leaking which emails exist.
        return {"message": "If that email is registered, a reset link has been sent."}
    except Exception:
        # Fail open — never reveal whether the email exists.
        return {"message": "If that email is registered, a reset link has been sent."}
    finally:
        _gen.close()


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


def oauth_login_or_register(
    provider: str,
    provider_user_id: str,
    email: str,
    full_name: str,
    avatar: str = "",
) -> dict:
    """Find or create a user from an OAuth provider and return JWT tokens."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.email == email).first()

        if user:
            # Existing user — log them in
            access_token = create_access_token(user.id, extra_claims={"role": user.role})
            refresh_token = create_refresh_token(user.id, role=user.role)
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user_id": user.id,
                "role": user.role,
            }

        # New user — create account with student role by default
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # random password
            role="student",
        )
        db.add(user)
        db.flush()

        profile = Student(user_id=user.id, full_name=full_name)
        db.add(profile)
        db.commit()

        access_token = create_access_token(user.id, extra_claims={"role": "student"})
        refresh_token = create_refresh_token(user.id, role="student")
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": "student",
        }
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            return _dev_token_response(email, "student")
        raise
    finally:
        _gen.close()
