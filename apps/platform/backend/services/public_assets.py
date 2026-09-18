"""Optional public CDN / R2 base for immutable uploads.

When ``Settings.public_assets_base`` is an https URL, GET /uploads/{file}
redirects there so large media can leave the Railway origin. Lesson/game HTML
``src``/``href`` under ``/uploads/`` is rewritten to that origin so the iframe
never hops through Railway on 2G.
"""

from __future__ import annotations

import re

_UPLOAD_ATTR_RE = re.compile(
    r'(\b(?:src|href)\s*=\s*)(["\'])(/uploads/[^"\']+)\2',
    re.IGNORECASE,
)


def public_asset_url(filename: str, base: str | None) -> str | None:
    raw = (base or "").strip()
    if not raw or not filename:
        return None
    if not raw.lower().startswith("https://"):
        return None
    return f"{raw.rstrip('/')}/{str(filename).lstrip('/')}"


def rewrite_upload_urls(html: str, base: str | None) -> str:
    if not html:
        return html or ""
    raw = (base or "").strip()
    if not raw.lower().startswith("https://"):
        return html
    prefix = raw.rstrip("/")

    def _repl(match: re.Match[str]) -> str:
        return f"{match.group(1)}{match.group(2)}{prefix}{match.group(3)}{match.group(2)}"

    return _UPLOAD_ATTR_RE.sub(_repl, html)


def apply_public_asset_urls(html: str) -> str:
    try:
        from backend.config.settings import get_settings

        return rewrite_upload_urls(html, get_settings().public_assets_base)
    except Exception:
        return html
