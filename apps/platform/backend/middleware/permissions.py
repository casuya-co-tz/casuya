from fastapi import Depends, HTTPException, status

from .auth import get_current_user


def require_role(*allowed_roles: str):
    def dependency(user=Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(allowed_roles)}",
            )
        return user

    return dependency


def require_active(user=Depends(get_current_user)):
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user
