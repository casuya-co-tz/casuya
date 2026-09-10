"""Authentication — email/password login and token refresh."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.security import create_access_token, create_refresh_token, decode_refresh_token, verify_password
from backend.config.settings import get_settings
from backend.models.student import Student
from backend.models.user import User
from backend.services.auth_service.tokens import _dev_token_response

settings = get_settings()


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
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "user_id": user.id,
        }
    except ValueError:
        raise
    except Exception:
        if settings.environment == "development":
            # DB unavailable: preserve the role embedded in the refresh token
            # so admins/teachers are not downgraded to students on refresh.
            role = payload.get("role") or "student"
            access_token = create_access_token(payload["sub"], extra_claims={"role": role})
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "role": role,
                "user_id": payload["sub"],
            }
        raise
    finally:
        _gen.close()