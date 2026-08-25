from backend.config.security import hash_password, verify_password, create_access_token, decode_access_token


def test_password_hashing():
    pw = "secure-password-123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong", hashed) is False


def test_jwt_token():
    token = create_access_token("user-1", extra_claims={"role": "admin"})
    assert token is not None
    payload = decode_access_token(token)
    assert payload["sub"] == "user-1"
    assert payload["role"] == "admin"
