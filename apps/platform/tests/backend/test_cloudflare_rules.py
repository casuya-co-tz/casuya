"""Unit tests for Cloudflare Cache Rules payload mapping (no network)."""

from integrations.cloudflare import _cf_rule


def test_cf_rule_cache_overrides_ttl():
    rule = _cf_rule(
        {
            "description": "Cache uploads",
            "expression": 'starts_with(http.request.uri.path, "/uploads/")',
            "action": {"type": "cache", "edge_ttl": 31536000, "browser_ttl": 31536000, "cache": True},
        },
        0,
    )
    assert rule["action"] == "set_cache_settings"
    assert rule["action_parameters"]["cache"] is True
    assert rule["action_parameters"]["edge_ttl"]["mode"] == "override_origin"
    assert rule["action_parameters"]["edge_ttl"]["default"] == 31536000
    assert rule["enabled"] is True


def test_cf_rule_bypass_sets_cache_false():
    rule = _cf_rule(
        {
            "description": "Never cache HTML",
            "expression": 'ends_with(http.request.uri.path, ".html")',
            "action": {"type": "bypass_cache"},
        },
        1,
    )
    assert rule["action_parameters"] == {"cache": False}
    assert "edge_ttl" not in rule["action_parameters"]
