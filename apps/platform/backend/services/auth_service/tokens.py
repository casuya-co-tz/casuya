"""Auth token helpers for development fallback responses."""

from __future__ import annotations

from backend.config.security import create_access_token, create_refresh_token


def _dev_token_response(email: str, role: str | None = None) -> dict:
    """Generate a real JWT for a mock dev user when the database is unavailable.

    The synthetic ``sub`` uses a ``dev-`` prefix so users are never confused
    with real accounts. These tokens only satisfy the *login* call; every
    authenticated request afterwards fails with 401 because the ``dev-*`` user
    does not exist in the database (``middleware/auth.py`` looks up ``sub``).
    """
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