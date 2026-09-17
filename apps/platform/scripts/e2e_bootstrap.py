"""Prepare the sqlite database for Playwright e2e (run before uvicorn starts)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT))

    os.environ.setdefault("JWT_SECRET", "ci-e2e-only-jwt-secret-value-0123456789abcdefgh")
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")

    db_path = ROOT / "e2e_casuya.db"
    storage_root = ROOT / "storage-e2e"
    storage_root.mkdir(parents=True, exist_ok=True)

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["STORAGE_ROOT"] = str(storage_root)

    if db_path.exists():
        db_path.unlink()

    from database.seeds.seed_dev_data import run

    run()


if __name__ == "__main__":
    main()
