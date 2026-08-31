"""Proxy routes that forward /api/* requests to the casuya-api gateway."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

from backend.config.settings import get_settings

router = APIRouter(prefix="/api", tags=["casuya-api-proxy"])

# Reuse a single async httpx client for connection pooling (P2-9)
_http_client: httpx.AsyncClient | None = None


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=30,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_casuya_api(request: Request, path: str):
    settings = get_settings()
    target = f"{settings.casuya_api_url.rstrip('/')}/api/{path}"
    body = await request.body()
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length", "transfer-encoding")
    }
    client = await _get_http_client()
    resp = await client.request(
        method=request.method,
        url=target,
        content=body,
        headers=headers,
        params=dict(request.query_params),
    )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
    )
