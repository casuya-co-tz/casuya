import uuid
from pathlib import Path

from backend.config.settings import get_settings


def store_upload(file_bytes: bytes, filename: str, kind: str) -> str:
    settings = get_settings()
    ext = Path(filename).suffix if "." in filename else ""
    storage_path = Path(settings.storage_root) / kind
    storage_path.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    full_path = storage_path / unique_name
    full_path.write_bytes(file_bytes)
    return str(full_path)
