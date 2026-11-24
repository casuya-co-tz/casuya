"""Shared, pooled HTTP clients for outbound microservice calls.

Creating an ``httpx.Client`` per request throws away connection pooling and
adds TCP/TLS setup to every lesson/audio/OCR request on 2G/3G links. These
helpers keep one client per (timeout, pool-size) configuration per process and
close them at shutdown.

``get_async_client`` must be used from ``async def`` endpoints so a slow
upstream cannot block the event loop. ``get_sync_client`` is for the sync
endpoints that FastAPI already runs in a worker thread.
"""

from __future__ import annotations

import threading

import httpx

_DEFAULT_MAX_CONNECTIONS = 20
_DEFAULT_MAX_KEEPALIVE = 10

_async_clients: dict[tuple[float, int, int], httpx.AsyncClient] = {}
_sync_clients: dict[tuple[float, int, int], httpx.Client] = {}
_sync_lock = threading.Lock()


def _key(timeout: float, max_connections: int, max_keepalive: int) -> tuple[float, int, int]:
    return (float(timeout), max_connections, max_keepalive)


def _limits(max_connections: int, max_keepalive: int) -> httpx.Limits:
    return httpx.Limits(
        max_connections=max_connections,
        max_keepalive_connections=max_keepalive,
        keepalive_expiry=30.0,
    )


def get_async_client(
    timeout: float = 30.0,
    *,
    max_connections: int = _DEFAULT_MAX_CONNECTIONS,
    max_keepalive: int = _DEFAULT_MAX_KEEPALIVE,
) -> httpx.AsyncClient:
    """Return a shared async client for the given timeout/pool configuration."""
    key = _key(timeout, max_connections, max_keepalive)
    client = _async_clients.get(key)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(timeout=timeout, limits=_limits(max_connections, max_keepalive))
        _async_clients[key] = client
    return client


def get_sync_client(
    timeout: float = 30.0,
    *,
    max_connections: int = _DEFAULT_MAX_CONNECTIONS,
    max_keepalive: int = _DEFAULT_MAX_KEEPALIVE,
) -> httpx.Client:
    """Return a shared sync client for the given timeout/pool configuration."""
    key = _key(timeout, max_connections, max_keepalive)
    with _sync_lock:
        client = _sync_clients.get(key)
        if client is None or client.is_closed:
            client = httpx.Client(timeout=timeout, limits=_limits(max_connections, max_keepalive))
            _sync_clients[key] = client
        return client


async def aclose_http_clients() -> None:
    """Close every pooled async client (call from application shutdown)."""
    for client in list(_async_clients.values()):
        if not client.is_closed:
            await client.aclose()
    _async_clients.clear()


def close_http_clients() -> None:
    """Close every pooled sync client (call from application shutdown)."""
    with _sync_lock:
        for client in list(_sync_clients.values()):
            if not client.is_closed:
                client.close()
        _sync_clients.clear()
