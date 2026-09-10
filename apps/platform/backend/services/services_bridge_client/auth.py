from __future__ import annotations


class AuthMixin:
    # ─── Auth ──────────────────────────────────────────────────────────────
    def register_user(self, payload: dict) -> dict:
        return self._request("POST", "/auth/register", json=payload)

    def login(self, email: str, password: str) -> dict:
        return self._request("POST", "/auth/login", json={"email": email, "password": password})

    def verify_token(self, token: str) -> dict:
        return self._request("POST", "/auth/verify", json={"token": token})

    def refresh_token(self, refresh_token: str) -> dict:
        return self._request("POST", "/auth/refresh", json={"refreshToken": refresh_token})

    def hash_password(self, password: str) -> str:
        return self._request("POST", "/auth/hash", json={"password": password})

    def verify_password(self, password: str, password_hash: str) -> bool:
        return self._request("POST", "/auth/verify-password", json={"password": password, "hash": password_hash}).get(
            "valid", False
        )

    def check_permission(self, payload: dict) -> dict:
        return self._request("POST", "/auth/permission", json=payload)

    def get_user_roles(self, user_id: str) -> list:
        return self._request("GET", f"/auth/roles/{user_id}")

    def create_policy(self, payload: dict) -> dict:
        return self._request("POST", "/auth/policy", json=payload)

    def evaluate_policy(self, payload: dict) -> dict:
        return self._request("POST", "/auth/policy/evaluate", json=payload)

    def setup_mfa(self, user_id: str, method: str) -> dict:
        return self._request("POST", "/auth/mfa/setup", json={"userId": user_id, "method": method})

    def audit(self, payload: dict) -> dict:
        return self._request("POST", "/auth/audit", json=payload)