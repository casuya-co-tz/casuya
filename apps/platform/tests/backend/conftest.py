import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def create_admin_user(email: str, password: str = "test123", full_name: str = "Test Admin"):
    """Insert an admin user directly in the DB and return (user_id, access_token).

    Mirrors database/seeds/create_admin.py — admins are never obtainable through
    the public /auth/register endpoint, so tests bootstrap them via the DB.
    """
    import backend.config.database as db_module
    from backend.config.security import create_access_token, hash_password

    with db_module.SessionLocal() as s:
        from backend.models.user import User

        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role="admin",
            is_active=True,
        )
        s.add(user)
        s.commit()
        user_id = user.id

    token = create_access_token(user_id, extra_claims={"role": "admin"})
    return user_id, token