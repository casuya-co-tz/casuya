from __future__ import annotations

import json
import re
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
from backend.services.email_service import send_password_reset_email, send_password_reset_sms

settings = get_settings()

# Roles that are treated as "student" in the system but may carry extra metadata.
_SPECIAL_ROLES = {"special_needs"}


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


def register_user(
    email: str,
    password: str,
    full_name: str,
    role: str = "student",
    phone: str | None = None,
    accessibility_prefs: dict | None = None,
) -> dict:
    # Map special-needs roles to the canonical "student" role so portal guards,
    # JWT claims, and dashboard routing all work without extra cases.
    db_role = "student" if role in _SPECIAL_ROLES else role

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
            role=db_role,
        )
        db.add(user)
        db.flush()
        if db_role == "student":
            prefs_json = json.dumps(accessibility_prefs) if accessibility_prefs else None
            profile = Student(
                user_id=user.id,
                full_name=full_name,
                accessibility_prefs=prefs_json,
            )
            db.add(profile)
        elif db_role == "teacher":
            profile = Teacher(user_id=user.id, full_name=full_name)
            db.add(profile)
        db.commit()
        access_token = create_access_token(user.id, extra_claims={"role": db_role})
        refresh_token = create_refresh_token(user.id, role=db_role)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": db_role,
            "accessibility_prefs": accessibility_prefs if db_role == "student" else None,
        }
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            return _dev_token_response(email, db_role)
        raise
    finally:
        _gen.close()


def authenticate_user(email: str, password: str, keep_logged_in: bool = False) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is deactivated")
        if keep_logged_in:
            access_minutes = settings.remember_access_token_expire_days * 24 * 60
            access_days = settings.remember_access_token_expire_days
        else:
            access_minutes = None
            access_days = None
        access_token = create_access_token(
            user.id, extra_claims={"role": user.role}, expire_minutes=access_minutes
        )
        refresh_token = create_refresh_token(user.id, role=user.role, expire_days=access_days)

        result: dict = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": user.role,
        }

        # Include stored accessibility prefs for student accounts.
        if user.role == "student":
            student = db.query(Student).filter(Student.user_id == user.id).first()
            if student and student.accessibility_prefs:
                try:
                    result["accessibility_prefs"] = json.loads(student.accessibility_prefs)
                except (json.JSONDecodeError, TypeError):
                    pass

        return result
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


def oauth_login_or_register(
    provider: str,
    provider_user_id: str,
    email: str,
    full_name: str,
    avatar: str = "",
    role: str = "pending",
) -> dict:
    """Find or create a user from an OAuth provider and return JWT tokens.

    New users default to role ``"pending"`` so the frontend can prompt them
    to choose between student and teacher before completing registration.
    """
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

        # New user — create account with pending role (user selects later)
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # random password
            role=role,
        )
        db.add(user)
        db.flush()

        profile = Student(user_id=user.id, full_name=full_name)
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


def complete_registration(user_id: str, role: str) -> dict:
    """Set the role for a newly-registered OAuth user who chose student/teacher."""
    if role not in ("student", "teacher"):
        raise ValueError("Role must be 'student' or 'teacher'")

    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        if user.role != "pending":
            # Already completed — just return fresh tokens
            access_token = create_access_token(user.id, extra_claims={"role": user.role})
            refresh_token = create_refresh_token(user.id, role=user.role)
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user_id": user.id,
                "role": user.role,
            }

        user.role = role
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
    finally:
        _gen.close()
