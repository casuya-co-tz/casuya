"""Role model and permission-helper tests."""

from __future__ import annotations

from backend.config.roles import (
    ADMIN,
    ALL_ROLES,
    BRIDGE,
    PENDING,
    STUDENT,
    STUDENT_ALIASES,
    TEACHER,
    normalize_role,
    roles_satisfying,
)


def test_canonical_roles_are_explicit():
    assert {"student", "teacher", "admin", "pending", "bridge"} <= ALL_ROLES
    # No moderator role by design: moderation is an admin capability.
    assert "moderator" not in ALL_ROLES
    assert STUDENT_ALIASES == {"special_needs"}
    assert normalize_role("special_needs") == STUDENT
    assert normalize_role("teacher") == TEACHER


def test_role_hierarchy_only_promotes_admin():
    assert roles_satisfying(TEACHER, hierarchy=True) == {TEACHER, ADMIN}
    assert roles_satisfying(STUDENT, hierarchy=True) == {STUDENT, ADMIN}
    assert roles_satisfying(ADMIN, hierarchy=True) == {ADMIN}
    assert roles_satisfying(BRIDGE, hierarchy=True) == {BRIDGE}
    # Exact matching remains the default for existing call sites.
    assert roles_satisfying(TEACHER) == {TEACHER}


def test_require_role_hierarchy_accepts_admin_for_teacher():
    from backend.middleware.permissions import require_role

    check = require_role(TEACHER, hierarchy=True)
    assert check({"role": ADMIN})["role"] == ADMIN
    assert check({"role": TEACHER})["role"] == TEACHER
    try:
        check({"role": PENDING})
    except Exception as exc:  # FastAPI HTTPException
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("pending role must not satisfy a teacher check")
