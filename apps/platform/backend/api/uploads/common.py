"""Shared helpers for the uploads API — filesystem scan, metadata merge and
WebP variant generation."""

from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel

from backend.config.database import get_db
from backend.config.settings import get_settings
from backend.models.file_record import FileRecord

logger = logging.getLogger("backend.api.uploads")

ALLOWED_KINDS = {"images", "videos", "audio", "documents"}

IMAGE_EXTS = {"png", "jpg", "jpeg", "gif"}
RESPONSIVE_WIDTHS = [320, 640, 960]

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

# File scan cache: avoids re-scanning the filesystem on every request (P-06)
_scan_cache: dict = {"files": None, "expires_at": 0}
_SCAN_CACHE_TTL = 30  # seconds


def _generate_webp_variants(content: bytes, filename: str, kind: str) -> None:
    """Generate WebP responsive variants for uploaded images.

    Creates 320w, 640w, 960w WebP files alongside the original so the
    CDN can serve modern formats to browsers that support them.
    Silently skips if Pillow is not installed or the image can't be processed.
    """
    if kind != "images":
        return
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in IMAGE_EXTS:
        return

    try:
        from io import BytesIO
        from PIL import Image

        img = Image.open(BytesIO(content))
        settings = get_settings()
        storage = Path(settings.storage_root) / "images"

        # Determine the base name without extension for variant filenames
        name_part = filename.rsplit(".", 1)[0] if "." in filename else filename
        # Variants are stored alongside the original
        variant_dir = storage

        for width in RESPONSIVE_WIDTHS:
            if img.width <= width:
                # Image is smaller than this variant; use original size
                continue
            # Resize maintaining aspect ratio
            ratio = width / img.width
            new_height = int(img.height * ratio)
            resized = img.resize((width, new_height), Image.LANCZOS)
            # Save as WebP
            webp_name = f"{name_part}-{width}w.webp"
            webp_path = variant_dir / webp_name
            buf = BytesIO()
            resized.save(buf, format="WEBP", quality=80)
            webp_path.write_bytes(buf.getvalue())

    except ImportError:
        pass  # Pillow not installed; skip silently
    except Exception as exc:
        logger.warning("WebP variant generation failed for %s: %s", filename, exc)


class FileUpdateRequest(BaseModel):
    display_name: str | None = None
    is_visible: bool | None = None


def _scan_files() -> list[dict]:
    now = time.time()
    if _scan_cache["files"] is not None and now < _scan_cache["expires_at"]:
        return _scan_cache["files"]

    settings = get_settings()
    root = Path(settings.storage_root)
    files = []
    for kind_dir in root.iterdir() if root.exists() else []:
        if not kind_dir.is_dir() or kind_dir.name.startswith("."):
            continue
        for f in kind_dir.iterdir():
            if f.is_file() and not f.name.startswith("."):
                st = f.stat()
                files.append(
                    {
                        "filename": f.name,
                        "path": f"{kind_dir.name}/{f.name}",
                        "kind": kind_dir.name,
                        "size": st.st_size,
                        "uploaded_at": st.st_mtime,
                    }
                )
    files.sort(key=lambda x: x.get("uploaded_at") or 0, reverse=True)
    _scan_cache["files"] = files
    _scan_cache["expires_at"] = now + _SCAN_CACHE_TTL
    return files


def _merge_with_db_meta(files: list[dict]) -> list[dict]:
    """Enrich filesystem scan results with DB metadata (display_name, is_visible)."""
    gen = get_db()
    db = next(gen)
    try:
        # Only the metadata columns are needed here; selecting with_entities
        # avoids pulling the large `data` (BYTEA) blobs on every uploads list.
        records = db.query(FileRecord.id, FileRecord.filename, FileRecord.display_name, FileRecord.is_visible).all()
        meta_map = {r.filename: {"id": r.id, "display_name": r.display_name, "is_visible": r.is_visible} for r in records}
        result = []
        for f in files:
            rec = meta_map.get(f["filename"])
            f["display_name"] = rec["display_name"] if rec else f["filename"]
            f["is_visible"] = rec["is_visible"] if rec else True
            if rec:
                f["id"] = rec["id"]
            result.append(f)
        return result
    except Exception as exc:
        logger.warning("Failed to merge DB metadata for uploads: %s", exc)
        return files
    finally:
        gen.close()


def _sanitize_filename(filename: str) -> str:
    """Reject filenames with path separators or .. components (S-08)."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return filename
