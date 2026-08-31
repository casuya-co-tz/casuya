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
    resp = client.post(
        f"/zones/{settings.cloudflare_zone_id}/purge_cache",
        json={"files": paths},
    )
    resp.raise_for_status()


def purge_cache_tags(tags: list[str]):
    """Purge everything carrying one of these Cache-Tags (e.g. "lesson-content").

    Safe no-op when Cloudflare credentials are absent. Pair with a Cache-Tag
    response header on the cached asset so an edit can bust the edge copy.
    """
    client = _get_client()
    if not client:
        return
    settings = get_settings()
    resp = client.post(
        f"/zones/{settings.cloudflare_zone_id}/purge_cache",
        json={"tags": tags},
    )
    resp.raise_for_status()


# ── Cache Rules Deployment (P3-1) ──────────────────────────────────────────

_RULES_FILE = Path(__file__).resolve().parent.parent / "docker" / "cloudflare" / "cache-rules.json"


def deploy_cache_rules() -> dict:
    """Deploy cache rules from cache-rules.json to the Cloudflare zone.

    Reads the rules file, lists existing rules, creates/updates as needed.
    Returns a summary of actions taken. Safe no-op when credentials are absent.
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

    # Fetch existing cache rules from Cloudflare
    existing = []
    try:
        resp = client.get(f"/zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success"):
                existing = data.get("result", {}).get("rules", [])
    except Exception as e:
        logger.warning("Failed to fetch existing Cloudflare rules: %s", e)

    # Build ruleset payload
    cf_rules = []
    for i, rule in enumerate(rules):
        cf_rules.append({
            "expression": rule["expression"],
            "action": "set_cache_settings" if rule["action"].get("cache") else "skip",
            "action_parameters": {
                "override": {
                    "edge_ttl": rule["action"].get("edge_ttl", 0),
                    "browser_ttl": rule["action"].get("browser_ttl", 0),
                }
            } if rule["action"].get("cache") else {},
            "description": rule.get("description", f"Rule {i+1}"),
        })

    ruleset_payload = {
        "rules": cf_rules,
        "phase": "http_request_cache_settings",
        "kind": "zone",
        "name": "Casuya Cache Rules",
        "description": "Auto-deployed by casuya-platform",
    }

    # Create or update the ruleset
    action = "updated" if existing else "created"
    try:
        if existing:
            # Get the ruleset ID from existing entrypoint
            resp = client.get(f"/zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint")
            if resp.status_code == 200:
                ruleset_id = resp.json().get("result", {}).get("id")
                if ruleset_id:
                    resp = client.put(f"/zones/{zone_id}/rulesets/{ruleset_id}", json=ruleset_payload)
                else:
                    resp = client.post(f"/zones/{zone_id}/rulesets", json=ruleset_payload)
                    action = "created"
            else:
                resp = client.post(f"/zones/{zone_id}/rulesets", json=ruleset_payload)
                action = "created"
        else:
            resp = client.post(f"/zones/{zone_id}/rulesets", json=ruleset_payload)
            action = "created"

        if resp.status_code in (200, 201):
            return {"status": "success", "action": action, "rules_count": len(cf_rules)}
        else:
            return {"status": "error", "action": action, "reason": resp.text[:200]}
    except Exception as e:
        return {"status": "error", "reason": str(e)[:200]}
