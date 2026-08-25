from backend.tasks.sync import run_pending_sync_reconciliation
from backend.tasks.reports import refresh_all_lesson_analytics
from backend.tasks.cleanup import run_cleanup


def test_sync_reconciliation():
    result = run_pending_sync_reconciliation()
    assert isinstance(result, int)


def test_analytics_refresh():
    result = refresh_all_lesson_analytics()
    assert isinstance(result, int)


def test_cleanup():
    result = run_cleanup()
    assert isinstance(result, int)
