import hashlib
import hmac
import json

from backend.config.settings import get_settings


def verify_bridge_payload(payload: dict, signature: str) -> bool:
    settings = get_settings()
    if not settings.casuya_bridge_shared_key:
        raise RuntimeError("CASUYA_BRIDGE_SHARED_KEY not configured")
    expected = hmac.new(
        settings.casuya_bridge_shared_key.encode(),
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
