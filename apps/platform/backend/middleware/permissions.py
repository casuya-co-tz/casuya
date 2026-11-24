from __future__ import annotations

import logging
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from backend.config.roles import ADMIN, ALL_ROLES, TEACHER, roles_satisfying

from .auth import get_current_user

logger = logging.getLogger(__name__)

#: Roles allowed to act on *any* learner's record (admin or their teacher).
STAFF_ROLES = frozenset({ADMIN, TEACHER})


def is_staff(user: dict) -> bool:
    """True when the caller may act on any student's data."""
    return user.get("role") in STAFF_ROLES


def is_admin(user: dict) -> bool:
    return user.get("role") == ADMIN


def assert_staff(user: dict, detail: str = "Requires admin or teacher") -> dict:
    if not is_staff(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    return user


def assert_admin(user: dict, detail: str = "Requires admin") -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    return user


def assert_staff_or_owner(user: dict, owner_id: str | None, detail: str = "Not authorized") -> dict:
    """Allow staff on any record, otherwise only the record's owner."""
    if is_staff(user):
        return user
    if owner_id is not None and user.get("sub") == owner_id:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_role(*allowed_roles: str, hierarchy: bool = False) -> Callable:
    """Require one of ``allowed_roles``.

    By default matching is exact, which preserves the behaviour of the ~50
    existing call sites. New endpoints can pass ``hierarchy=True`` so an admin
    automatically satisfies a teacher/student check without duplicating
    ``("admin", "teacher")`` tuples everywhere.

    Unknown role names are logged so typos are caught without breaking a
    deploy (a misspelled role would otherwise silently deny everyone).
    """
    for role in allowed_roles:
        if role not in ALL_ROLES:
            logger.warning("require_role() called with unknown role %r", role)

    accepted: frozenset[str] = frozenset().union(
        *(roles_satisfying(r, hierarchy=hierarchy) for r in allowed_roles)
    )

    def dependency(user=Depends(get_current_user)):
        if user.get("role") not in accepted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(allowed_roles)}",
            )
        return user

    return dependency


def role_at_least(minimum: str, user=Depends(get_current_user)):
    """Convenience dependency: ``minimum`` role or a higher-privileged one."""
    return require_role(minimum, hierarchy=True)(user)


def require_active(user=Depends(get_current_user)):
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user
