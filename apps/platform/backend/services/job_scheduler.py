"""Periodic maintenance scheduler for the platform.

The task functions live in ``backend.tasks`` but were never invoked by
production code. This module wires them on an interval from the leader worker
only, using RQ when Redis is available and an in-process thread fallback when
it is not (so maintenance still runs on single-instance deployments).

All interval values are seconds and can be overridden with environment
variables, e.g. ``JOB_CLEANUP_INTERVAL=21600``.
"""

from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


def _interval(name: str, default: int) -> float:
    try:
        return max(1.0, float(os.environ.get(name, default)))
    except ValueError:
        return float(default)


# (label, queue, dotted function path, interval env var, default seconds)
SCHEDULED_JOBS = (
    ("cleanup", "low", "backend.tasks.cleanup.run_cleanup", "JOB_CLEANUP_INTERVAL", 6 * 3600),
    ("analytics", "low", "backend.tasks.reports.refresh_all_lesson_analytics", "JOB_ANALYTICS_INTERVAL", 6 * 3600),
    ("sync-reconciliation", "low", "backend.tasks.sync.run_pending_sync_reconciliation", "JOB_SYNC_INTERVAL", 3600),
    ("weekly-digests", "low", "backend.tasks.notifications.send_weekly_digests", "JOB_DIGEST_INTERVAL", 24 * 3600),
)

_scheduler_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


def _enqueue_or_run(label: str, queue: str, func_path: str) -> None:
    from backend.config.jobs import enqueue_job

    job = enqueue_job(queue, func_path)
    if job is not None:
        logger.info("Scheduled job %s queued (%s)", label, getattr(job, "id", "?"))
        return

    # RQ unavailable: run the task in a worker thread so maintenance is not
    # lost on single-instance / Redis-less installations.
    module_name, func_name = func_path.rsplit(".", 1)
    try:
        module = __import__(module_name, fromlist=[func_name])
        func = getattr(module, func_name)
        result = func()
        logger.info("Scheduled job %s completed inline: %s", label, result)
    except Exception as exc:  # noqa: BLE001
        logger.error("Scheduled job %s failed: %s", label, exc)


async def _loop(stop: asyncio.Event, leader: bool) -> None:
    if not leader:
        logger.info("Job scheduler disabled on non-leader worker")
        return

    deadlines = {label: _interval(env_name, default) for label, _, _, env_name, default in SCHEDULED_JOBS}
    logger.info("Job scheduler started: %s", deadlines)
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=1.0)
            break
        except TimeoutError:
            pass
        for label, queue, func_path, env_name, default in SCHEDULED_JOBS:
            deadlines[label] -= 1.0
            if deadlines[label] <= 0:
                deadlines[label] = _interval(env_name, default)
                await asyncio.to_thread(_enqueue_or_run, label, queue, func_path)
    logger.info("Job scheduler stopped")


def start_job_scheduler(*, leader: bool = True) -> None:
    """Start the periodic scheduler (idempotent)."""
    global _scheduler_task, _stop_event
    if _scheduler_task is not None and not _scheduler_task.done():
        return
    _stop_event = asyncio.Event()
    _scheduler_task = asyncio.create_task(_loop(_stop_event, leader), name="casuya-job-scheduler")


async def stop_job_scheduler() -> None:
    """Signal the scheduler and wait for it to exit."""
    global _scheduler_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    task = _scheduler_task
    if task is not None and not task.done():
        try:
            await asyncio.wait_for(task, timeout=5)
        except TimeoutError:
            task.cancel()
    _scheduler_task = None
    _stop_event = None
