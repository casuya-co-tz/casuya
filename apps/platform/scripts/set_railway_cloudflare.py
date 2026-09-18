"""Push Cloudflare/R2 env vars to the linked Railway platform service.

Reads values from local .env files. Never prints secret values.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLATFORM = Path(__file__).resolve().parents[1]
ENV_PATHS = [ROOT / ".env", PLATFORM / ".env"]
RAILWAY = Path(os.environ.get("APPDATA", "")) / "npm" / "railway.cmd"
SERVICE = "33047dba-85d2-451e-aa84-df8f29ea378c"
ENVIRONMENT = "production"
KEYS = (
    "CLOUDFLARE_ZONE_ID",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_S3_ENDPOINT",
    "PUBLIC_ASSETS_BASE",
)


def _load_env_files() -> None:
    for path in ENV_PATHS:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip('"').strip("'")


def _run_railway(args: list[str], stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    cmd = ["cmd.exe", "/c", str(RAILWAY), *args]
    return subprocess.run(cmd, input=stdin, text=True, capture_output=True)


def main() -> int:
    if not RAILWAY.exists():
        print(f"railway cli missing at {RAILWAY}")
        return 1
    _load_env_files()
    failed = 0
    for key in KEYS:
        value = (os.environ.get(key) or "").strip()
        if not value:
            print(f"{key} MISSING")
            failed += 1
            continue
        proc = _run_railway(
            [
                "variable",
                "set",
                key,
                "--stdin",
                "--service",
                SERVICE,
                "--environment",
                ENVIRONMENT,
                "--skip-deploys",
            ],
            stdin=value,
        )
        redacted_err = (proc.stderr or "").replace(value, "***")[:240].strip()
        if proc.returncode == 0:
            print(f"{key} set")
        else:
            failed += 1
            print(f"{key} FAIL {proc.returncode} {redacted_err}")
    if failed:
        return failed
    redeploy = _run_railway(
        [
            "redeploy",
            "--service",
            SERVICE,
            "--environment",
            ENVIRONMENT,
            "-y",
        ]
    )
    if redeploy.returncode != 0:
        err = (redeploy.stderr or redeploy.stdout or "")[:300].strip()
        print(f"redeploy FAIL {redeploy.returncode} {err}")
        return 1
    print("redeploy started")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
