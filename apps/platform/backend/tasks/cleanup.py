import time
from pathlib import Path

from backend.config.settings import get_settings


def run_cleanup():
    settings = get_settings()
    storage = Path(settings.storage_root)
    removed = 0
    for pattern in ("*.tmp", "*.temp"):
        for f in storage.rglob(pattern):
            try:
                f.unlink()
                removed += 1
            except OSError:
                pass
    return removed
