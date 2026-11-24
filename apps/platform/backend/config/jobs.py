"""Redis Queue (RQ) configuration for background jobs.

Degrades gracefully when Redis is unavailable: queue access is deferred until
first use, and enqueue attempts are skipped (returning None) if Redis is down.
"""

from __future__ import annotations

import logging
from typing import Any

from redis import Redis
from redis.exceptions import RedisError
from rq import Queue

from backend.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Enqueue attempts are observable instead of silently returning None. Useful
# for readiness dashboards and tests without requiring a metrics backend.
_job_stats: dict[str, int] = {"attempted": 0, "enqueued": 0, "failed": 0, "skipped_no_redis": 0}


def get_job_stats() -> dict[str, int]:
    """Return a copy of the in-process enqueue counters."""
    return dict(_job_stats)


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
    """Enqueue a job, recording and logging every failure.

    Callers can inspect ``get_job_stats()``; the scheduler additionally logs
    failed enqueues so a Redis outage cannot silently drop maintenance work.
    """
    _job_stats["attempted"] += 1
    queues = _get_queues()
    if not queues:
        _job_stats["skipped_no_redis"] += 1
        logger.warning("Job %s not enqueued: Redis unavailable", func)
        return None
    queue = queues.get(queue_name, queues["default"])
    try:
        job = queue.enqueue(func, *args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        _job_stats["failed"] += 1
        logger.error("Job %s enqueue failed: %s", func, exc)
        return None
    _job_stats["enqueued"] += 1
    return job
