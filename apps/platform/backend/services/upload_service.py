import os
import uuid
from pathlib import Path

from backend.config.settings import get_settings


def _r2_client():
    """Return a boto3 S3 client for Cloudflare R2, or None if not configured."""
    s = get_settings()
    account_id = getattr(s, "r2_account", None) or getattr(s, "r2_account_id", None) or getattr(s, "cloudflare_account_id", None)
    access_key = getattr(s, "r2_access_key_id", None)
    secret_key = getattr(s, "r2_secret_access_key", None)
    endpoint = getattr(s, "r2_endpoint_resolved", None) or (f"https://{account_id}.r2.cloudflarestorage.com" if account_id else None)
    if not (account_id and access_key and secret_key and endpoint):
        return None
    try:
        import boto3
    except ImportError:
        return None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def store_upload(file_bytes: bytes, filename: str, kind: str) -> str:
    settings = get_settings()
    ext = Path(filename).suffix if "." in filename else ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    key = f"{kind}/{unique_name}"

    client = _r2_client()
    bucket = getattr(settings, "r2_bucket_resolved", None) or getattr(settings, "r2_bucket", None) or getattr(settings, "r2_bucket_name", None)
    if client is not None and bucket:
        client.put_object(Bucket=bucket, Key=key, Body=file_bytes)
        return key

    # Local filesystem fallback (dev / no R2 configured)
    storage_path = Path(settings.storage_root) / kind
    storage_path.mkdir(parents=True, exist_ok=True)
    full_path = storage_path / unique_name
    full_path.write_bytes(file_bytes)
    return str(full_path)