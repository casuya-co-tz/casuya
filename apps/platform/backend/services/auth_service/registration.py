"""User registration and OAuth account lifecycle."""

from __future__ import annotations

import json
import secrets

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.security import create_access_token, create_refresh_token, hash_password
from backend.config.settings import get_settings
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User
from backend.services.auth_service.tokens import _dev_token_response

settings = get_settings()

# Roles that are treated as "student" in the system but may carry extra metadata.
_SPECIAL_ROLES = {"special_needs"}


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
            full_name=full_name,
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
            full_name=full_name,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # random password
            role=role,
        )
        db.add(user)
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
    """Set the role for a newly-registered OAuth user who chose student/teacher.

    Creates the appropriate profile (Student or Teacher) based on the selected
    role, using the full_name stored on the User during OAuth registration.
    """
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
        full_name = user.full_name or ""

        # Create the appropriate profile for the chosen role
        if role == "teacher":
            # Remove any existing Student profile
            existing_student = db.query(Student).filter(Student.user_id == user.id).first()
            if existing_student:
                db.delete(existing_student)
            teacher = Teacher(user_id=user.id, full_name=full_name)
            db.add(teacher)
        else:
            # role == "student" — create Student profile if not present
            existing_student = db.query(Student).filter(Student.user_id == user.id).first()
            if not existing_student:
                student = Student(user_id=user.id, full_name=full_name)
                db.add(student)

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
