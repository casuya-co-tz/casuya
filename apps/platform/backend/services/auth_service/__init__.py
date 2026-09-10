"""Auth service — register, login, refresh, password reset and OAuth flows.

Delegates to focused submodules but exposes the full public API so existing
``from backend.services.auth_service import ...`` imports keep working.
"""

from __future__ import annotations

from backend.services.auth_service.login import authenticate_user, refresh_access_token
from backend.services.auth_service.password import forgot_password, reset_password
from backend.services.auth_service.registration import (
    complete_registration,
    oauth_login_or_register,
    register_user,
)

__all__ = [
    "authenticate_user",
    "complete_registration",
    "forgot_password",
    "oauth_login_or_register",
    "refresh_access_token",
    "register_user",
    "reset_password",
]