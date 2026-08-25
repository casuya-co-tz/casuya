"""Redis Queue (RQ) configuration for background jobs.

Degrades gracefully when Redis is unavailable: queue access is deferred until
first use, and enqueue attempts are skipped (returning None) if Redis is down.
"""

from __future__ import annotations

from typing import Any

from redis import Redis
from redis.exceptions import RedisError
from rq import Queue

from backend.config.settings import get_settings

settings = get_settings()

_redis_conn: Redis | None = None
_queues: dict[str, Queue] | None = None


def _get_connection() -> Redis | None:
    global _redis_conn
    if _redis_conn is None:
        try:
            _redis_conn = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
            _redis_conn.ping()
        except RedisError:
            _redis_conn = None
    return _redis_conn


def _get_queues() -> dict[str, Queue]:
    global _queues
    if _queues is None:
        conn = _get_connection()
        if conn is None:
            return {}
        _queues = {
            "default": Queue("default", connection=conn),
            "high": Queue("high", connection=conn),
            "low": Queue("low", connection=conn),
        }
    return _queues


def enqueue_job(queue_name: str, func: str, *args: Any, **kwargs: Any):
    queues = _get_queues()
    if not queues:
        # Redis unavailable — skip background job silently.
        return None
    queue = queues.get(queue_name, queues["default"])
    return queue.enqueue(func, *args, **kwargs)
