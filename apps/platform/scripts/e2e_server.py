"""Boot uvicorn with a fresh sqlite seed for Playwright e2e (B-05)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "e2e_casuya.db"


def main() -> None:
    os.chdir(ROOT)
    os.environ.setdefault(
        "JWT_SECRET",
        "ci-e2e-only-jwt-secret-value-0123456789abcdefgh",
    )
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB.as_posix()}")
    os.environ.setdefault("STORAGE_ROOT", str(ROOT / "storage-e2e"))
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")

    if DB.exists():
        DB.unlink()

    subprocess.run([sys.executable, "-m", "database.seeds.seed_dev_data"], check=True)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8765",
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
