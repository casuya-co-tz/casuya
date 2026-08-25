import json

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.config.database import get_db, redis_client
from backend.config.security import decode_access_token
from backend.config.settings import get_settings
from backend.models.user import User

settings = get_settings()

USER_CACHE_TTL = 60


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
    if settings.environment == "development" and str(payload.get("sub", "")).startswith("dev-"):
        return payload

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
    except Exception:
        pass

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
        try:
            user_data = {"id": user.id, "is_active": user.is_active}
            redis_client.setex(cache_key, USER_CACHE_TTL, json.dumps(user_data).encode("utf-8"))
        except Exception:
            pass
        return payload
    except HTTPException:
        raise
    except Exception:
        if settings.environment == "development":
            return payload
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
    # Prefer JWT if present
    if authorization and authorization.startswith("Bearer "):
        try:
            return get_current_user(authorization)
        except HTTPException:
            pass  # fall through to shared key

    # Fall back to shared key
    if x_bridge_key and settings.casuya_bridge_shared_key:
        if x_bridge_key == settings.casuya_bridge_shared_key:
            return {"sub": "bridge", "role": "bridge"}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bridge key")

    if authorization and authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
