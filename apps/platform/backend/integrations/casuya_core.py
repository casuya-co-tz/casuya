"""Adapter for casuya-core — lesson compilation, packaging, and signing.

This module provides a bridge between casuya-platform and casuya-core,
using casuya-core's public API directly instead of reimplementing logic.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from pathlib import Path

from backend.config.settings import get_settings


def _get_signing_key() -> bytes:
    settings = get_settings()
    if not settings.casuya_core_signing_key:
        raise RuntimeError(
            "CASUYA_CORE_SIGNING_KEY is not configured. Set it in your .env file to enable lesson package signing."
        )
    return settings.casuya_core_signing_key.encode()


def package_lesson(
    lesson_id: str,
    html_content: str,
    version: str = "1.0.0",
) -> dict:
    """Package a lesson into a signed JSON bundle.

    Computes a SHA-256 content hash and signs the package with HMAC-SHA256
    using the shared CASUYA_CORE_SIGNING_KEY.
    """
    content_hash = hashlib.sha256(html_content.encode("utf-8")).hexdigest()

    package = {
        "id": lesson_id,
        "version": version,
        "html": html_content,
        "content_hash": content_hash,
        "package_version": version,
    }

    # Sign the package
    payload = json.dumps(
        {"id": package["id"], "content_hash": content_hash, "version": version},
        sort_keys=True,
    ).encode()
    signature = hmac.new(_get_signing_key(), payload, hashlib.sha256).hexdigest()
    package["signature"] = signature

    return package


def verify_package(package: dict) -> bool:
    """Verify a lesson package's HMAC signature."""
    try:
        signature = package.get("signature", "")
        payload = json.dumps(
            {
                "id": package["id"],
                "content_hash": package["content_hash"],
                "version": package["version"],
            },
            sort_keys=True,
        ).encode()
        expected = hmac.new(_get_signing_key(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False


def save_package(lesson_id: str, package: dict) -> Path:
    """Save a packaged lesson to the filesystem."""
    settings = get_settings()
    pkg_dir = Path(settings.storage_root) / "lesson-packages"
    pkg_dir.mkdir(parents=True, exist_ok=True)
    pkg_path = pkg_dir / f"{lesson_id}.json"
    pkg_path.write_text(json.dumps(package, indent=2), encoding="utf-8")
    return pkg_path


def load_package(lesson_id: str) -> dict | None:
    """Load a packaged lesson from the filesystem."""
    settings = get_settings()
    pkg_path = Path(settings.storage_root) / "lesson-packages" / f"{lesson_id}.json"
    if not pkg_path.exists():
        return None
    return json.loads(pkg_path.read_text(encoding="utf-8"))
