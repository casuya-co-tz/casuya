import json
import logging

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.config.database import get_db, redis_client
from backend.config.security import decode_access_token
from backend.config.settings import get_settings
from backend.models.user import User

logger = logging.getLogger(__name__)

settings = get_settings()

USER_CACHE_TTL = 300  # 5 minutes (increased from 60s to reduce DB load)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    cache_key = f"cache:user:{user_id}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            user_data = json.loads(cached)
            if not user_data.get("is_active"):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
            return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Redis cache read failed for user %s: %s", user_id, exc)

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
        try:
            user_data = {"id": user.id, "is_active": user.is_active}
            redis_client.setex(cache_key, USER_CACHE_TTL, json.dumps(user_data).encode("utf-8"))
        except Exception as exc:
            logger.warning("Redis cache write failed for user %s: %s", user_id, exc)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected auth error for user %s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def optional_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    try:
        return decode_access_token(token)
    except Exception:
        return None


def bridge_auth(x_bridge_key: str | None = Header(default=None), authorization: str | None = Header(default=None)):
    """Authenticate bridge sync requests via JWT or shared key.

    Used by casuya-bridge clients that sync progress from student devices.
    """
    # If JWT is present, it is the ONLY auth method tried (no shared key fallback).
    if authorization and authorization.startswith("Bearer "):
        try:
            return get_current_user(authorization)
        except HTTPException:
            raise  # re-raise — JWT was present but invalid

    # Fall back to shared key only when no JWT is provided
    if x_bridge_key and settings.casuya_bridge_shared_key:
        if x_bridge_key == settings.casuya_bridge_shared_key:
            return {"sub": "bridge", "role": "bridge"}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bridge key")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
