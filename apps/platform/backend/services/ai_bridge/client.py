"""AI bridge — HTTP client for the casuya-ai microservice."""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

CASUYA_AI_URL = (os.getenv("CASUYA_AI_URL", "http://localhost:3000") or "").rstrip("/")

# Reuse a single async httpx client for connection pooling (P2-9)
_http_client: httpx.AsyncClient | None = None


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


async def _call_ai_service(endpoint: str, payload: dict) -> dict | None:
    """Call the casuya-ai service and return the response, or None on failure."""
    try:
        client = await _get_http_client()
        resp = await client.post(f"{CASUYA_AI_URL}{endpoint}", json=payload)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("casuya-ai service unavailable at %s: %s", CASUYA_AI_URL, exc)
        return None
