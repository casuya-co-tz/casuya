"""DB-free tests for the isolated web-analytics event pipeline.

The analytics cluster is a separate Neon database with no test fixture, so
only the pure normalization/privacy/classification logic is covered here.
"""

import hashlib
import re

import pytest

from backend.services.analytics_events import (
    _clamp_int,
    _visitor_hash,
    normalize_ingest,
    resolve_device_profile,
)


def test_normalize_ingest_valid():
    row = normalize_ingest({"path": "/login", "type": "page_exit_metric", "scroll": 45, "duration": 120})
    assert row == {
        "route_path": "/login",
        "interaction_type": "page_exit_metric",
        "scroll_depth": 45,
        "active_duration": 120,
        "device_profile": None,
    }


@pytest.mark.parametrize(
    "payload",
    [
        None,
        "not-a-dict",
        {},
        {"path": "/x"},                          # missing interaction type
        {"type": "   "},                         # blank interaction type
        ["/x", "page_exit_metric"],              # not a dict
    ],
)
def test_normalize_ingest_drops(payload):
    assert normalize_ingest(payload) is None


def test_normalize_ingest_clamps_and_truncates():
    row = normalize_ingest({"path": "x" * 500, "type": "y" * 500, "scroll": "9999", "duration": -5})
    assert len(row["route_path"]) == 255
    assert len(row["interaction_type"]) == 50
    assert row["scroll_depth"] == 100
    assert row["active_duration"] == 0


def test_normalize_ingest_non_numeric_counts_as_zero():
    row = normalize_ingest({"path": "/", "type": "page_exit_metric", "scroll": "abc", "duration": None})
    assert row["scroll_depth"] == 0
    assert row["active_duration"] == 0


@pytest.mark.parametrize(
    ("ua", "expected"),
    [
        ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1", "mobile"),
        ("Mozilla/5.0 (iPad; CPU OS 16_0) AppleWebKit/605.1.15 Mobile/15E148", "tablet"),
        ("Mozilla/5.0 (X11; Linux x86_64) Chrome/129 Desktop", "desktop"),
        ("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "bot"),
        ("", "unknown"),
    ],
)
def test_resolve_device_profile(ua, expected):
    assert resolve_device_profile(ua) == expected


def test_visitor_hash_is_salted_and_deterministic_per_day():
    h1 = _visitor_hash("1.2.3.4", "ua-string")
    h2 = _visitor_hash("1.2.3.4", "ua-string")
    h3 = _visitor_hash("9.9.9.9", "ua-string")
    assert h1 == h2
    assert h1 != h3
    assert re.fullmatch(r"[0-9a-f]{64}", h1)
    assert len(h1) == hashlib.sha256().digest_size * 2


def test_clamp_int():
    assert _clamp_int(15, 0, 100) == 15
    assert _clamp_int(-1, 0, 100) == 0
    assert _clamp_int(101, 0, 100) == 100
    assert _clamp_int("abc", 0, 100) == 0
