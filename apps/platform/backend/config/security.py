from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import jwt

from .settings import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, "type": "access", "jti": str(uuid4()), **(extra_claims or {})}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, role: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {"sub": subject, "exp": expire, "type": "refresh", "jti": str(uuid4())}
    if role:
        payload["role"] = role
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def decode_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload
