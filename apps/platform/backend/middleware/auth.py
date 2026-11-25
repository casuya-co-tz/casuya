import json
import logging

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.config.database import get_db, redis_client
from backend.config.security import decode_access_token
from backend.config.settings import get_settings
from backend.config.roles import normalize_role
from backend.models.user import User

logger = logging.getLogger(__name__)

settings = get_settings()

USER_CACHE_TTL = 300  # 5 minutes (increased from 60s to reduce DB load)


def _resolve_current_user(authorization: str | None, db: Session) -> dict:
    """Resolve a bearer token to a user dict against the live DB.

    Shared by ``get_current_user`` and ``bridge_auth`` so the bridge path (which
    calls this directly, outside FastAPI DI) still gets a real session.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    cache_key = f"cache:user:{user_id}"

    # Development-only fallback for synthetic dev tokens (mirrors the
    # login/refresh fallbacks in ``auth_service``): when the platform runs with
    # environment=development and the database is unreachable, login/refresh
    # mint ``dev-*`` tokens. Accept them here too so the session issued by a
    # successful login actually works for authenticated calls — otherwise every
    # follow-up request 401s and the client logs the user straight back out.
    if isinstance(user_id, str) and user_id.startswith("dev-"):
        if settings.environment.strip().lower() == "development":
            return {**payload, "is_active": True, "role": normalize_role(payload.get("role")) or payload.get("role") or "student"}

    try:
        cached = redis_client.get(cache_key)
        if cached:
            user_data = json.loads(cached)
            if not user_data.get("is_active"):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
            # Prefer the DB-backed role when the cache has one, so a role change
            # takes effect as soon as the cache is invalidated instead of
            # lingering for the lifetime of the JWT.
            result = {**payload, "is_active": user_data.get("is_active", True)}
            if user_data.get("role"):
                result["role"] = normalize_role(user_data["role"]) or user_data["role"]
            return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Redis cache read failed for user %s: %s", user_id, exc)

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
        try:
            db_role = normalize_role(user.role) or user.role
            user_data = {"id": user.id, "is_active": user.is_active, "role": db_role}
            redis_client.setex(cache_key, USER_CACHE_TTL, json.dumps(user_data).encode("utf-8"))
        except Exception as exc:
            logger.warning("Redis cache write failed for user %s: %s", user_id, exc)
        db_role = normalize_role(user.role) or user.role
        return {**payload, "is_active": user.is_active, "role": db_role}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected auth error for user %s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    return _resolve_current_user(authorization, db)


def optional_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    try:
        return decode_access_token(token)
    except Exception:
        return None


def bridge_auth(
    authorization: str | None = Header(default=None),
    x_bridge_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Authenticate bridge sync requests via JWT or shared key.

    Used by casuya-bridge clients that sync progress from student devices.
    """
    # If JWT is present, it is the ONLY auth method tried (no shared key fallback).
    if authorization and authorization.startswith("Bearer "):
        try:
            return _resolve_current_user(authorization, db)
        except HTTPException:
            raise  # re-raise — JWT was present but invalid

    # Fall back to shared key only when no JWT is provided
    if x_bridge_key and settings.casuya_bridge_shared_key:
        if x_bridge_key == settings.casuya_bridge_shared_key:
            return {"sub": "bridge", "role": "bridge"}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bridge key")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
