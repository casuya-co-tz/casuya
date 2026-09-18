"""Inspect and relax Cloudflare bot challenges for casuya.co.tz.

Never prints secret values.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
PLATFORM = Path(__file__).resolve().parents[1]
ZONE_ID = "902d9fb7b7d88c2f7b8a20a8dffefaa1"


def _load_env() -> None:
    for path in (ROOT / ".env", PLATFORM / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip('"').strip("'")


def _summarize(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except Exception:
        return f"http {resp.status_code} {resp.text[:200]}"
    err = (body.get("errors") or [{}])[0]
    msg = err.get("message") or body.get("messages")
    result = body.get("result")
    if isinstance(result, dict):
        keep = {
            k: result.get(k)
            for k in (
                "fight_mode",
                "enable_js",
                "ai_bots_protection",
                "sbfm_likely_automated",
                "sbfm_definitely_automated",
                "value",
                "id",
            )
            if k in result
        }
        return f"http {resp.status_code} success={body.get('success')} {keep or msg}"
    return f"http {resp.status_code} success={body.get('success')} {msg}"


def main() -> int:
    _load_env()
    token = (os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not token:
        print("CLOUDFLARE_API_TOKEN missing")
        return 1
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    client = httpx.Client(base_url="https://api.cloudflare.com/client/v4", headers=headers, timeout=30)
    try:
        page = httpx.get(
            "https://www.casuya.co.tz/",
            timeout=25,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Linux; Android 8.0; SM-J250F) Chrome/70.0.3538.80 Mobile Safari/537.36"},
        )
        text = page.text.lower()
        print(
            "www",
            page.status_code,
            "cf-ray",
            bool(page.headers.get("cf-ray")),
            "mitigated",
            page.headers.get("cf-mitigated"),
            "challenge",
            "bot" in text and "verif" in text,
            "title_bot",
            "security verification" in text or "malicious bots" in text,
        )

        security = client.get(f"/zones/{ZONE_ID}/settings/security_level")
        print("security_level", _summarize(security))
        bots = client.get(f"/zones/{ZONE_ID}/bot_management")
        print("bot_management", _summarize(bots))

        patched = client.patch(
            f"/zones/{ZONE_ID}/settings/security_level",
            json={"value": "essentially_off"},
        )
        print("set security_level essentially_off", _summarize(patched))

        disabled = client.put(
            f"/zones/{ZONE_ID}/bot_management",
            json={"fight_mode": False, "enable_js": False},
        )
        print("disable fight_mode", _summarize(disabled))
        if disabled.status_code >= 400:
            disabled = client.put(
                f"/zones/{ZONE_ID}/bot_management",
                json={"fight_mode": False},
            )
            print("disable fight_mode retry", _summarize(disabled))

        security2 = client.get(f"/zones/{ZONE_ID}/settings/security_level")
        bots2 = client.get(f"/zones/{ZONE_ID}/bot_management")
        print("security_level now", _summarize(security2))
        print("bot_management now", _summarize(bots2))
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
