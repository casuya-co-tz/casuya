from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_register():
    resp = client.post("/auth/register", json={
        "email": "test@test.com",
        "password": "test123",
        "full_name": "Test User",
        "role": "student",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate():
    client.post("/auth/register", json={
        "email": "dup@test.com",
        "password": "test123",
        "full_name": "Test User",
    })
    resp = client.post("/auth/register", json={
        "email": "dup@test.com",
        "password": "test123",
        "full_name": "Test User",
    })
    assert resp.status_code == 409


def test_login():
    client.post("/auth/register", json={
        "email": "login@test.com",
        "password": "test123",
        "full_name": "Test User",
    })
    resp = client.post("/auth/login", json={
        "email": "login@test.com",
        "password": "test123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_invalid():
    resp = client.post("/auth/login", json={
        "email": "nonexistent@test.com",
        "password": "wrong",
    })
    assert resp.status_code == 401


def test_refresh():
    reg = client.post("/auth/register", json={
        "email": "refresh@test.com",
        "password": "test123",
        "full_name": "Test User",
    })
    refresh_token = reg.json()["refresh_token"]
    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def _decode_role(access_token: str) -> str | None:
    import base64
    import json

    payload = access_token.split(".")[1]
    # JWT payload is base64url; normalize for standard base64 decoding.
    payload += "=" * (-len(payload) % 4)
    decoded = json.loads(base64.urlsafe_b64decode(payload))
    return decoded.get("role")


def test_refresh_preserves_role():
    """A refreshed access token must carry the same role as the user."""
    for role in ("admin", "teacher", "student"):
        email = f"role-{role}@test.com"
        reg = client.post("/auth/register", json={
            "email": email,
            "password": "test123",
            "full_name": "Test User",
            "role": role,
        })
        if reg.status_code == 409:
            # Already registered from a prior run — authenticate instead.
            reg = client.post("/auth/login", json={"email": email, "password": "test123"})
        assert reg.status_code == 200, f"Failed to register/login {role}: {reg.text}"
        refresh_token = reg.json()["refresh_token"]
        resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200, f"refresh failed for {role}"
        assert _decode_role(resp.json()["access_token"]) == role, f"role not preserved for {role}"


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
