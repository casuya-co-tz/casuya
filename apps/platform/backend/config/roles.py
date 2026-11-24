"""Canonical role model for the platform.

The platform has four real roles plus two transitional/service identities:

* ``student`` — learner; owns a :class:`~backend.models.student.Student` profile.
* ``teacher`` — educator; can create classrooms and assignments. Self-service
  registration is intentional (see ``select-role.html``).
* ``admin`` — full platform administration. Created only via seed scripts,
  never through the public registration endpoint.
* ``pending`` — OAuth onboarding state until the user picks student/teacher.
* ``special_needs`` — registration alias that maps onto ``student``.
* ``bridge`` — service identity for offline sync (shared key or JWT).

There is deliberately **no moderator role**. Moderation is an admin capability;
adding a new privileged role would require auditing every ``require_role`` call
site. If moderation is ever productised, add it here and extend
``ROLE_HIERARCHY`` in one place rather than sprinkling string checks.
"""

from __future__ import annotations

STUDENT = "student"
TEACHER = "teacher"
ADMIN = "admin"
PENDING = "pending"
SPECIAL_NEEDS = "special_needs"
BRIDGE = "bridge"

#: Roles accepted by public registration (admin is seed-only).
PUBLIC_ROLES = frozenset({STUDENT, TEACHER, SPECIAL_NEEDS})

#: Roles that map onto the canonical ``student`` identity.
STUDENT_ALIASES = frozenset({SPECIAL_NEEDS})

#: Every known identity, useful for validation and status dashboards.
ALL_ROLES = frozenset({STUDENT, TEACHER, ADMIN, PENDING, SPECIAL_NEEDS, BRIDGE})

#: Privilege ordering used by ``role_at_least``. Sibling roles are NOT
#: ordered relative to each other; only admin dominates both learner roles.
ROLE_RANK = {
    PENDING: 0,
    STUDENT: 1,
    TEACHER: 1,
    ADMIN: 2,
}

#: Roles that satisfy a check for a given role. Used by ``require_role(...,
#: hierarchy=True)`` for new endpoints; existing endpoints keep exact matching.
ROLE_HIERARCHY = {
    STUDENT: frozenset({STUDENT, ADMIN}),
    TEACHER: frozenset({TEACHER, ADMIN}),
    ADMIN: frozenset({ADMIN}),
    PENDING: frozenset({PENDING, STUDENT, TEACHER, ADMIN}),
    BRIDGE: frozenset({BRIDGE}),
}


def normalize_role(role: str | None) -> str | None:
    """Map registration aliases onto their canonical role."""
    if role in STUDENT_ALIASES:
        return STUDENT
    return role


def roles_satisfying(role: str, *, hierarchy: bool = False) -> frozenset[str]:
    """Return the set of roles allowed to satisfy a check for ``role``."""
    if hierarchy and role in ROLE_HIERARCHY:
        return ROLE_HIERARCHY[role]
    return frozenset({role})
