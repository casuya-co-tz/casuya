from __future__ import annotations

import json
import logging
from pathlib import Path

from httpx import Client

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)


def _get_client() -> Client | None:
    """Return an httpx Client configured for the Cloudflare API, or None."""
    settings = get_settings()
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        return None
    return Client(
        base_url="https://api.cloudflare.com/client/v4",
        headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
        timeout=15.0,
    )


def purge_cache(paths: list[str]):
    client = _get_client()
    if not client:
        return
    settings = get_settings()
    try:
        resp = client.post(
            f"/zones/{settings.cloudflare_zone_id}/purge_cache",
            json={"files": paths},
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Cloudflare cache purge (files) failed: %s", exc)


def purge_cache_tags(tags: list[str]):
    """Purge everything carrying one of these Cache-Tags (e.g. "lesson-content").

    Safe no-op when Cloudflare credentials are absent. Pair with a Cache-Tag
    response header on the cached asset so an edit can bust the edge copy.
    Never raises — lesson publish must succeed even if the edge purge fails.
    """
    client = _get_client()
    if not client:
        return
    settings = get_settings()
    try:
        resp = client.post(
            f"/zones/{settings.cloudflare_zone_id}/purge_cache",
            json={"tags": tags},
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Cloudflare cache purge (tags=%s) failed: %s", tags, exc)


# ── Cache Rules Deployment (P3-1) ──────────────────────────────────────────

_RULES_FILE = Path(__file__).resolve().parent.parent / "docker" / "cloudflare" / "cache-rules.json"


def _cf_rule(rule: dict, index: int) -> dict:
    """Map cache-rules.json entries to Cloudflare Cache Rules API shape."""
    action = rule.get("action") or {}
    cache_on = bool(action.get("cache"))
    payload: dict = {
        "expression": rule["expression"],
        "description": rule.get("description", f"Rule {index + 1}"),
        "enabled": True,
        "action": "set_cache_settings",
        "action_parameters": {"cache": cache_on},
    }
    if cache_on:
        edge = int(action.get("edge_ttl") or 0)
        browser = int(action.get("browser_ttl") or 0)
        if edge > 0:
            payload["action_parameters"]["edge_ttl"] = {
                "mode": "override_origin",
                "default": edge,
            }
        if browser > 0:
            payload["action_parameters"]["browser_ttl"] = {
                "mode": "override_origin",
                "default": browser,
            }
    return payload


def deploy_cache_rules() -> dict:
    """Replace the zone Cache Rules entrypoint with cache-rules.json.

    Safe no-op when credentials are absent. Uses
    PUT /zones/{id}/rulesets/phases/http_request_cache_settings/entrypoint.
    """
    client = _get_client()
    if not client:
        return {"status": "skipped", "reason": "cloudflare credentials not configured"}

    settings = get_settings()
    zone_id = settings.cloudflare_zone_id

    if not _RULES_FILE.exists():
        return {"status": "skipped", "reason": "cache-rules.json not found"}

    try:
        rules_data = json.loads(_RULES_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        return {"status": "error", "reason": f"failed to parse rules: {e}"}

    rules = rules_data.get("rules", [])
    if not rules:
        return {"status": "skipped", "reason": "no rules defined"}

    cf_rules = [_cf_rule(rule, i) for i, rule in enumerate(rules)]
    payload = {
        "name": "Casuya Cache Rules",
        "description": rules_data.get("description") or "Auto-deployed by casuya-platform",
        "rules": cf_rules,
    }

    try:
        resp = client.put(
            f"/zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint",
            json=payload,
        )
        if resp.status_code == 400 and "name" in (resp.text or "").lower():
            payload.pop("name", None)
            resp = client.put(
                f"/zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint",
                json=payload,
            )
        if resp.status_code in (200, 201):
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            result = body.get("result") or {}
            return {
                "status": "success",
                "action": "updated",
                "rules_count": len(cf_rules),
                "ruleset_id": result.get("id"),
            }
        return {"status": "error", "action": "updated", "reason": resp.text[:400]}
    except Exception as e:
        return {"status": "error", "reason": str(e)[:200]}
