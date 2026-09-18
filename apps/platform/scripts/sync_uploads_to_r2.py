"""Copy production /uploads files into the casuya-uploads R2 bucket.

Never prints secret values. Dual-writes each object at `{name}` and
`uploads/{name}` so both the old 302 and HTML rewrite paths work.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
PLATFORM = Path(__file__).resolve().parents[1]
ENV_PATHS = [ROOT / ".env", PLATFORM / ".env"]
ORIGIN = "https://casuya-platform-production.up.railway.app"
CDN = "https://cdn.casuya.co.tz"
PUBLIC_LIST = f"{ORIGIN}/uploads/public/"


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


def _upsert_env(path: Path, key: str, value: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    seen = False
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"# {key}=") or stripped.startswith(f"#{key}="):
            out.append(f"{key}={value}")
            seen = True
        else:
            out.append(line)
    if not seen:
        if out and out[-1] != "":
            out.append("")
        out.append(f"{key}={value}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def _content_type(name: str, data: bytes) -> str:
    if name.lower().endswith(".docx") or data[:2] == b"PK":
        if name.lower().endswith(".docx"):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"GIF8"):
        return "image/gif"
    if data.startswith(b"RIFF") and b"WEBP" in data[:16]:
        return "image/webp"
    stripped = data.lstrip()[:32].lower()
    if stripped.startswith(b"<svg") or stripped.startswith(b"<?xml"):
        return "image/svg+xml"
    if data[:4] in (b"\x00\x00\x01\x00", b"\x00\x00\x02\x00"):
        return "image/x-icon"
    return "application/octet-stream"


def _s3():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_S3_ENDPOINT"].strip(),
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"].strip(),
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def main() -> int:
    _load_env_files()
    for required in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_S3_ENDPOINT", "R2_BUCKET_NAME"):
        if not (os.environ.get(required) or "").strip():
            print(f"{required} missing")
            return 1

    bucket = os.environ["R2_BUCKET_NAME"].strip()
    listing = httpx.get(PUBLIC_LIST, timeout=30)
    listing.raise_for_status()
    files = listing.json()
    if not isinstance(files, list) or not files:
        print("no public uploads to copy")
        return 1
    print(f"listed {len(files)} files")

    s3 = _s3()
    s3.put_bucket_cors(
        Bucket=bucket,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": [
                        "https://casuya.co.tz",
                        "https://www.casuya.co.tz",
                        "https://casuya-platform-production.up.railway.app",
                    ],
                    "AllowedMethods": ["GET", "HEAD"],
                    "AllowedHeaders": ["*"],
                    "ExposeHeaders": ["ETag", "Content-Length"],
                    "MaxAgeSeconds": 86400,
                }
            ]
        },
    )
    print("cors set")

    uploaded = 0
    for item in files:
        name = item.get("filename")
        if not name:
            continue
        resp = httpx.get(f"{ORIGIN}/uploads/{name}", timeout=60)
        resp.raise_for_status()
        data = resp.content
        ctype = _content_type(name, data)
        extra = {
            "ContentType": ctype,
            "CacheControl": "public, max-age=31536000, immutable",
        }
        for key in (name, f"uploads/{name}"):
            s3.put_object(Bucket=bucket, Key=key, Body=data, **extra)
        uploaded += 1
        print(f"put {name} bytes={len(data)} type={ctype}")

    checked = 0
    for item in files:
        name = item.get("filename")
        url = f"{CDN}/uploads/{name}"
        probe = httpx.get(url, timeout=30)
        print(f"cdn {name} http {probe.status_code} bytes={len(probe.content)}")
        if probe.status_code != 200:
            return 2
        checked += 1

    for path in ENV_PATHS:
        _upsert_env(path, "PUBLIC_ASSETS_BASE", CDN)
    print(f"PUBLIC_ASSETS_BASE={CDN} uploaded={uploaded} checked={checked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
