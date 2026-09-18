"""Apply Casuya Cloudflare cache rules and ensure the R2 uploads bucket.

Reads credentials from .env / the process environment. Never prints secret values.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
PLATFORM = Path(__file__).resolve().parents[1]
ENV_PATHS = [ROOT / ".env", PLATFORM / ".env"]
DEFAULT_ACCOUNT_ID = "0f79cf0abd1bfed2afb8594bdecd196a"
DEFAULT_ZONE_ID = "902d9fb7b7d88c2f7b8a20a8dffefaa1"
DEFAULT_BUCKET = "casuya-uploads"
CDN_HOST = "cdn.casuya.co.tz"
UPSERT_KEYS = (
    "CLOUDFLARE_ZONE_ID",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_S3_ENDPOINT",
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


def _upsert_env(path: Path, values: dict[str, str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        replaced = False
        for key, value in values.items():
            prefixes = (f"{key}=", f"# {key}=", f"#{key}=")
            if stripped.startswith(prefixes):
                out.append(f"{key}={value}")
                seen.add(key)
                replaced = True
                break
        if not replaced:
            out.append(line)
    missing = [k for k in values if k not in seen]
    if missing:
        if out and out[-1] != "":
            out.append("")
        for key in missing:
            out.append(f"{key}={values[key]}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def _summarize_api(resp: httpx.Response) -> str:
    text = resp.text or ""
    try:
        body = resp.json()
    except Exception:
        return f"http {resp.status_code} {text[:240]}"
    errors = body.get("errors") or []
    err = errors[0] if errors else {}
    msg = err.get("message") or body.get("message") or text[:240]
    return f"http {resp.status_code} success={body.get('success')} {msg}"


def main() -> int:
    _load_env_files()
    token = (os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not token:
        print("CLOUDFLARE_API_TOKEN missing")
        return 1

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or DEFAULT_ACCOUNT_ID
    zone_id = os.environ.get("CLOUDFLARE_ZONE_ID") or DEFAULT_ZONE_ID
    bucket = os.environ.get("R2_BUCKET_NAME") or DEFAULT_BUCKET
    s3_endpoint = os.environ.get("R2_S3_ENDPOINT") or f"https://{account_id}.r2.cloudflarestorage.com"
    os.environ.setdefault("CLOUDFLARE_ZONE_ID", zone_id)
    os.environ.setdefault("CLOUDFLARE_ACCOUNT_ID", account_id)
    os.environ.setdefault("R2_BUCKET_NAME", bucket)
    os.environ.setdefault("R2_S3_ENDPOINT", s3_endpoint)

    values = {k: os.environ[k] for k in UPSERT_KEYS if os.environ.get(k)}
    for path in ENV_PATHS:
        _upsert_env(path, values)
        print(f"env upserted {path.name} keys={len(values)}")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    result: dict = {}
    try:
        client = httpx.Client(
            base_url="https://api.cloudflare.com/client/v4",
            headers=headers,
            timeout=30.0,
        )
    except Exception as exc:
        print(f"cloudflare client init failed: {type(exc).__name__}")
        return 1

    try:
        try:
            verify = client.get(f"/accounts/{account_id}/tokens/verify")
        except httpx.ConnectError:
            print("token verify connect failed: dns/network to api.cloudflare.com")
            return 1

        print(f"token verify {_summarize_api(verify)}")
        if verify.status_code != 200:
            return 1

        activation = client.put(f"/zones/{zone_id}/activation_check")
        print(f"activation check {_summarize_api(activation)}")
        zone = client.get(f"/zones/{zone_id}")
        zone_body = zone.json().get("result") if zone.status_code == 200 else {}
        print(
            f"zone status={zone_body.get('status')} name={zone_body.get('name')} "
            f"ns={','.join(zone_body.get('name_servers') or [])}"
        )

        sys.path.insert(0, str(PLATFORM))
        from backend.config.settings import get_settings
        from integrations.cloudflare import deploy_cache_rules

        get_settings.cache_clear()
        result = deploy_cache_rules() or {}
        print(
            "cache rules "
            + json.dumps({k: v for k, v in result.items() if k != "reason"})
            + (f" reason={result.get('reason')}" if result.get("reason") else "")
        )

        buckets = client.get(f"/accounts/{account_id}/r2/buckets")
        print(f"r2 list {_summarize_api(buckets)}")
        names: list[str] = []
        if buckets.status_code == 200:
            payload = buckets.json().get("result") or {}
            names = [b.get("name") for b in (payload.get("buckets") or []) if b.get("name")]
            print("r2 buckets " + ",".join(names) if names else "r2 buckets none")

        if buckets.status_code == 200 and bucket not in names:
            created = client.post(
                f"/accounts/{account_id}/r2/buckets",
                json={"name": bucket},
            )
            print(f"r2 create {bucket} {_summarize_api(created)}")
        elif bucket in names:
            print(f"r2 bucket exists {bucket}")

        domain = client.post(
            f"/accounts/{account_id}/r2/buckets/{bucket}/domains/custom",
            json={"domain": CDN_HOST, "enabled": True, "zoneId": zone_id},
        )
        print(f"r2 custom domain {CDN_HOST} {_summarize_api(domain)}")
        if domain.status_code not in (200, 201, 409):
            zone = client.get(f"/zones/{zone_id}")
            zone_body = zone.json().get("result") if zone.status_code == 200 else {}
            print(
                "zone lookup "
                + _summarize_api(zone)
                + f" name={zone_body.get('name')} status={zone_body.get('status')} type={zone_body.get('type')}"
            )
            zones = client.get("/zones", params={"name": "casuya.co.tz"})
            listed = (zones.json().get("result") or []) if zones.status_code == 200 else []
            ids = ",".join(f"{z.get('id')}:{z.get('status')}:{z.get('type')}" for z in listed) or "none"
            print("zones named casuya.co.tz " + ids)
        if domain.status_code in (200, 201, 409):
            print(f"set PUBLIC_ASSETS_BASE=https://{CDN_HOST} on Railway after TLS is active")
        else:
            managed = client.put(
                f"/accounts/{account_id}/r2/buckets/{bucket}/domains/managed",
                json={"enabled": True},
            )
            print(f"r2 managed domain {_summarize_api(managed)}")
            if managed.status_code in (200, 201):
                managed_body = managed.json().get("result") or {}
                pub = managed_body.get("domain")
                if pub:
                    print(f"r2.dev origin https://{pub} (do not set PUBLIC_ASSETS_BASE until custom domain works)")
    finally:
        client.close()

    return 0 if result.get("status") == "success" else 2


if __name__ == "__main__":
    raise SystemExit(main())
