import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def _clear_api_key(monkeypatch):
    """Keep tests open unless a case explicitly sets API_KEY."""
    monkeypatch.delenv("API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
