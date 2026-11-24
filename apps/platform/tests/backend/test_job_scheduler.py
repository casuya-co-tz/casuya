"""Tests for the periodic maintenance scheduler and enqueue observability."""

from __future__ import annotations

import asyncio

import pytest


@pytest.mark.asyncio
async def test_scheduler_starts_and_stops_cleanly():
    from backend.services.job_scheduler import start_job_scheduler, stop_job_scheduler

    start_job_scheduler(leader=True)
    await asyncio.sleep(0)
    await stop_job_scheduler()

    from backend.services import job_scheduler

    assert job_scheduler._scheduler_task is None
    assert job_scheduler._stop_event is None


@pytest.mark.asyncio
async def test_scheduler_is_inert_on_non_leader():
    from backend.services import job_scheduler

    await job_scheduler.stop_job_scheduler()
    job_scheduler.start_job_scheduler(leader=False)
    await asyncio.sleep(0.05)
    assert job_scheduler._scheduler_task is not None
    assert job_scheduler._scheduler_task.done()
    await job_scheduler.stop_job_scheduler()


def test_enqueue_stats_are_recorded(monkeypatch):
    from backend.config import jobs

    monkeypatch.setattr(jobs, "_get_queues", lambda: {})
    before = jobs.get_job_stats()
    assert jobs.enqueue_job("low", "backend.tasks.cleanup.run_cleanup") is None
    after = jobs.get_job_stats()
    assert after["attempted"] == before["attempted"] + 1
    assert after["skipped_no_redis"] == before["skipped_no_redis"] + 1


def test_mock_payments_rejected_in_production(monkeypatch):
    from backend.config.settings import Settings

    with pytest.raises(ValueError, match="AZAMPAY_MOCK"):
        Settings(environment="production", azampay_mock=True, jwt_secret="x" * 40)
