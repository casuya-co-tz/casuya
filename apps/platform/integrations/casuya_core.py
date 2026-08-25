import hashlib
import hmac
import json
import uuid
from pathlib import Path

from backend.config.settings import get_settings


def package_lesson(html: str, sign: bool = True) -> dict:
    settings = get_settings()
    content_hash = hashlib.sha256(html.encode()).hexdigest()
    package_version = "1.0.0"
    package_id = uuid.uuid4().hex
    package = {
        "id": package_id,
        "content_hash": content_hash,
        "package_version": package_version,
        "html": html,
    }
    if sign:
        if not settings.casuya_core_signing_key:
            raise RuntimeError("CASUYA_CORE_SIGNING_KEY not configured")
        signature = hmac.new(
            settings.casuya_core_signing_key.encode(),
            json.dumps(package, separators=(",", ":")).encode(),
            hashlib.sha256,
        ).hexdigest()
        package["signature"] = signature
    package_dir = Path(settings.storage_root) / "lesson-packages"
    package_dir.mkdir(parents=True, exist_ok=True)
    package_path = package_dir / f"{package_id}.json"
    package_path.write_text(json.dumps(package), encoding="utf-8")
    return {
        "package_path": str(package_path),
        "content_hash": content_hash,
        "package_version": package_version,
    }
