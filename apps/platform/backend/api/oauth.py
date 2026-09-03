"""OAuth login / registration endpoints for Google and Facebook.

Flow:
  1. Frontend opens GET /auth/oauth/{provider} → returns { url } (authorization URL).
  2. User authenticates with the provider.
  3. Provider redirects to GET /auth/callback/{provider}?code=…&state=…
  4. Backend exchanges code for user info, creates/finds local user, redirects
     to the frontend with JWT tokens in the URL fragment.
"""

from __future__ import annotations

import hmac
import secrets
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from backend.config.settings import get_settings
from backend.services.auth_service import oauth_login_or_register

settings = get_settings()

# OAuth routes are added to the auth router (defined in auth.py)
# to avoid duplicate prefix="/auth" registrations.
router = APIRouter(tags=["oauth"])

# ── Provider configurations ──────────────────────────────────────────────

PROVIDERS: dict[str, dict] = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "client_id_env": "google_client_id",
        "client_secret_env": "google_client_secret",
        "scope": "openid email profile",
        "get_user_info": lambda data: {
            "email": data["email"],
            "full_name": data.get("name", ""),
            "avatar": data.get("picture", ""),
        },
    },
    "facebook": {
        "authorize_url": "https://www.facebook.com/v19.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v19.0/oauth/access_token",
        "userinfo_url": "https://graph.facebook.com/me?fields=id,name,email",
        "client_id_env": "facebook_client_id",
        "client_secret_env": "facebook_client_secret",
        "scope": "email public_profile",
        "get_user_info": lambda data: {
            "email": data["email"],
            "full_name": data.get("name", ""),
            "avatar": "",
        },
    },
}


def _get_client_id(provider: str) -> str:
    cfg = PROVIDERS[provider]
    val = getattr(settings, cfg["client_id_env"], None)
    if not val:
        raise HTTPException(status_code=503, detail=f"{provider.title()} OAuth is not configured")
    return val


def _get_client_secret(provider: str) -> str:
    cfg = PROVIDERS[provider]
    val = getattr(settings, cfg["client_secret_env"], None)
    if not val:
        raise HTTPException(status_code=503, detail=f"{provider.title()} OAuth is not configured")
    return val


def _trusted_hosts() -> set[str]:
    """Hosts we are willing to derive an OAuth callback URL from.

    Prevents Host-header injection: an attacker could spoof the Host header
    to point the provider's redirect at an arbitrary domain. We only trust
    hosts we actually deploy on.
    """
    hosts: set[str] = {"localhost", "127.0.0.1", "testserver"}
    for raw in (settings.oauth_redirect_base, settings.frontend_base, *settings.allowed_origins):
        if raw:
            host = urlparse(raw).hostname
            if host:
                hosts.add(host)
    return hosts


def _callback_url(provider: str, request: Request | None = None) -> str:
    # Prefer the host the request actually arrived on so the redirect URI
    # always matches what's registered with the OAuth provider, regardless
    # of deployment (localhost, Render, custom domain). Only trust hosts we
    # deploy on to avoid Host-header injection.
    if request is not None:
        host = request.url.hostname
        if host and host in _trusted_hosts():
            base = str(request.base_url).rstrip("/")
            # Force HTTPS for remote hosts (behind a TLS-terminating proxy like
            # Railway) so the redirect URI matches the OAuth provider's registered
            # https:// URI even if the forwarded scheme is misconfigured.
            if host not in ("localhost", "127.0.0.1", "testserver"):
                base = base.replace("http://", "https://", 1)
            return f"{base}/auth/callback/{provider}"
    return f"{settings.oauth_redirect_base}/auth/callback/{provider}"


def _auth_redirect(target: str) -> RedirectResponse:
    """Redirect back to the frontend login page, clearing the OAuth state cookie."""
    response = RedirectResponse(target)
    response.delete_cookie("oauth_state", path="/")
    return response


# ── Step 1: Redirect to the authorization URL ────────────────────────────


@router.get("/oauth/{provider}")
@router.get("/oauth/{provider}/")
def oauth_initiate(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    client_id = _get_client_id(provider)
    cfg = PROVIDERS[provider]
    state = secrets.token_urlsafe(16)

    params = {
        "client_id": client_id,
        "redirect_uri": _callback_url(provider, request),
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    # Facebook doesn't use access_type/prompt
    if provider == "facebook":
        params.pop("access_type", None)
        params.pop("prompt", None)

    url = f"{cfg['authorize_url']}?{urlencode(params)}"
    response = RedirectResponse(url)
    # Store state in an HttpOnly cookie so we can verify it on the callback
    # (CSRF protection for the OAuth flow).
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=600,
        path="/",
    )
    return response


# ── Step 2: Handle the callback, exchange code, create/find user ─────────


@router.get("/callback/{provider}")
@router.get("/callback/{provider}/")
def oauth_callback(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    # Verify the state parameter against the cookie set during initiation
    # to prevent CSRF. Clear the cookie either way.
    state = request.query_params.get("state")
    cookie_state = request.cookies.get("oauth_state")
    state_ok = state and cookie_state and hmac.compare_digest(state, cookie_state)
    error_response = RedirectResponse(f"{settings.frontend_base}/login.html?error=state_mismatch")
    error_response.delete_cookie("oauth_state", path="/")
    if not state_ok:
        return error_response

    code = request.query_params.get("code")
    if not code:
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=no_code")

    cfg = PROVIDERS[provider]
    client_id = _get_client_id(provider)
    client_secret = _get_client_secret(provider)

    # Exchange authorization code for tokens
    try:
        token_resp = httpx.post(
            cfg["token_url"],
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _callback_url(provider, request),
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
    except Exception:
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=token_exchange_failed")

    access_token = token_data.get("access_token")
    if not access_token:
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=no_access_token")

    # Fetch user info
    try:
        userinfo_resp = httpx.get(
            cfg["userinfo_url"],
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
    except Exception:
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=userinfo_failed")

    user_info = cfg["get_user_info"](userinfo)
    if not user_info.get("email"):
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=no_email")

    # Create or find user, get JWT tokens
    try:
        result = oauth_login_or_register(
            provider=provider,
            provider_user_id=str(userinfo.get("id", "")),
            email=user_info["email"],
            full_name=user_info["full_name"],
            avatar=user_info.get("avatar", ""),
        )
    except Exception:
        return _auth_redirect(f"{settings.frontend_base}/login.html?error=account_creation_failed")

    # Redirect to frontend with tokens in the URL fragment
    fragment_data = {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "role": result["role"],
        "user_id": result["user_id"],
    }
    if result["role"] == "pending":
        fragment_data["needs_role"] = "true"
    fragment = urlencode(fragment_data)
    return _auth_redirect(f"{settings.frontend_base}/login.html?oauth=success#{fragment}")
