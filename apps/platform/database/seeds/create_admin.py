"""Production-safe admin provisioning.

Public registration intentionally cannot create admins (privilege
escalation risk), so admins are provisioned out-of-band. Use this from a
trusted environment / CI secret:

    python -m database.seeds.create_admin <email> <password> [full_name]

If arguments are omitted, it reads CASUYA_ADMIN_EMAIL / CASUYA_ADMIN_PASSWORD
/ CASUYA_ADMIN_NAME from the environment, and finally falls back to an
interactive prompt. Idempotent: an existing admin is updated in place.
"""

from __future__ import annotations

import getpass
import os
import sys

from backend.config.database import get_db, init_db
from backend.config.security import hash_password
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User


def _input(prompt: str, default: str = "") -> str:
    try:
        val = input(prompt).strip()
    except EOFError:
        val = ""
    return val or default


def create_admin(email: str, password: str, full_name: str) -> User:
    init_db()
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(email=email, hashed_password=hash_password(password), role="admin", is_active=True)
            db.add(user)
            db.flush()
            print(f"Created admin: {email}")
        else:
            user.role = "admin"
            user.is_active = True
            user.hashed_password = hash_password(password)
            print(f"Updated existing user to admin: {email}")

        # Ensure no stale student/teacher profile lingers for an admin.
        db.query(Student).filter(Student.user_id == user.id).delete()
        db.query(Teacher).filter(Teacher.user_id == user.id).delete()
        db.commit()
        return user
    finally:
        db.close()


def main() -> None:
    args = sys.argv[1:]
    email = args[0] if len(args) > 0 else os.environ.get("CASUYA_ADMIN_EMAIL", "")
    password = args[1] if len(args) > 1 else os.environ.get("CASUYA_ADMIN_PASSWORD", "")
    full_name = args[2] if len(args) > 2 else os.environ.get("CASUYA_ADMIN_NAME", "Platform Admin")

    if not email:
        email = _input("Admin email: ")
    if not password:
        password = getpass.getpass("Admin password: ") if sys.stdin.isatty() else _input("Admin password: ")

    if not email or not password:
        print("ERROR: email and password are required.", file=sys.stderr)
        sys.exit(1)

    create_admin(email, password, full_name)
    print("Done.")


if __name__ == "__main__":
    main()
