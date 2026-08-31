import asyncio
import logging
import os
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.config.database import get_db
from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.file_record import FileRecord
from backend.services.upload_service import store_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])

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
                files.append(
                    {
                        "filename": f.name,
                        "path": f"{kind_dir.name}/{f.name}",
                        "kind": kind_dir.name,
                        "size": f.stat().st_size,
                        "uploaded_at": f.stat().st_mtime,
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


@router.get("")
@router.get("/")
def list_files(current_user=Depends(require_role("admin"))):
    files = _scan_files()
    return _merge_with_db_meta(files)


@router.get("/public")
@router.get("/public/")
def list_files_public():
    files = _scan_files()
    enriched = _merge_with_db_meta(files)
    return [f for f in enriched if f.get("is_visible", True)]


@router.post("")
@router.post("/")
async def upload_file(file: UploadFile, current_user=Depends(require_role("admin"))):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Enforce upload size limit (S-07)
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    kind = {
        "png": "images",
        "jpg": "images",
        "jpeg": "images",
        "gif": "images",
        "svg": "images",
        "webp": "images",
        "pdf": "documents",
        "doc": "documents",
        "docx": "documents",
        "txt": "documents",
        "mp4": "videos",
        "webm": "videos",
        "mp3": "audio",
        "wav": "audio",
        "ogg": "audio",
    }.get(ext, "images")

    # Wrap sync filesystem + DB operations in to_thread to avoid blocking the event loop
    def _do_upload():
        stored_name = store_upload(content, file.filename, kind)
        # Generate WebP responsive variants for images (320w, 640w, 960w)
        _generate_webp_variants(content, file.filename, kind)
        filename_only = Path(stored_name).name
        gen = get_db()
        db = next(gen)
        try:
            record = FileRecord(
                filename=filename_only,
                display_name=file.filename,
                kind=kind,
                size=len(content),
                data=content,
                is_visible=True,
            )
            db.add(record)
            db.commit()
            _scan_cache["files"] = None  # invalidate scan cache
        except Exception as exc:
            logger.warning("Failed to create DB record for uploaded file %s: %s", file.filename, exc)
        finally:
            gen.close()
        return stored_name

    stored_name = await asyncio.to_thread(_do_upload)
    return {"path": stored_name, "filename": file.filename, "kind": kind}


@router.patch("/{filename:path}")
@router.patch("/{filename:path}/")
async def update_file(filename: str, body: FileUpdateRequest, current_user=Depends(require_role("admin"))):
    gen = get_db()
    db = next(gen)
    try:
        record = db.query(FileRecord).filter(FileRecord.filename == filename).first()
        if not record:
            record = FileRecord(
                filename=filename,
                display_name=filename,
                kind="documents",
                size=0,
                is_visible=True,
            )
            db.add(record)
            db.flush()
        if body.display_name is not None:
            record.display_name = body.display_name
        if body.is_visible is not None:
            record.is_visible = body.is_visible
        db.commit()
        _scan_cache["files"] = None  # invalidate scan cache
        return {
            "id": record.id,
            "filename": record.filename,
            "display_name": record.display_name,
            "is_visible": record.is_visible,
        }
    finally:
        gen.close()


def _sanitize_filename(filename: str) -> str:
    """Reject filenames with path separators or .. components (S-08)."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return filename


@router.get("/{filename:path}")
@router.get("/{filename:path}/")
async def serve_file(filename: str):
    _sanitize_filename(filename)
    settings = get_settings()
    root = Path(settings.storage_root)

    def _find_file():
        for kind_dir in root.iterdir() if root.exists() else []:
            if not kind_dir.is_dir():
                continue
            target = kind_dir / filename
            if target.exists() and target.is_file():
                return target
        return None

    target = await asyncio.to_thread(_find_file)
    if target:
        return FileResponse(target, filename=filename)

    # Fallback: serve from the database if the file was wiped from disk.
    def _db_fallback():
        gen = get_db()
        db = next(gen)
        try:
            record = db.query(FileRecord).filter(FileRecord.filename == filename).first()
            if record is not None and record.data is not None:
                return record.data, record.kind
        finally:
            gen.close()
        return None, None

    data, kind = await asyncio.to_thread(_db_fallback)
    if data is not None:
        from fastapi.responses import Response
        # Detect MIME type from extension (A-02)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        mime_map = {
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "svg": "image/svg+xml", "webp": "image/webp",
            "pdf": "application/pdf", "mp4": "video/mp4", "webm": "video/webm",
            "mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg",
        }
        media_type = mime_map.get(ext, "application/octet-stream")
        return Response(content=data, media_type=media_type)

    raise HTTPException(status_code=404, detail="File not found")


@router.delete("/{filename:path}")
@router.delete("/{filename:path}/")
async def delete_file(filename: str, current_user=Depends(require_role("admin"))):
    _sanitize_filename(filename)
    settings = get_settings()
    root = Path(settings.storage_root)

    def _do_delete():
        for kind_dir in root.iterdir() if root.exists() else []:
            if not kind_dir.is_dir():
                continue
            target = kind_dir / filename
            if target.exists() and target.is_file():
                target.unlink()
                gen = get_db()
                db = next(gen)
                try:
                    rec = db.query(FileRecord).filter(FileRecord.filename == filename).first()
                    if rec:
                        db.delete(rec)
                        db.commit()
                except Exception as exc:
                    logger.warning("Failed to delete DB record for %s: %s", filename, exc)
                finally:
                    gen.close()
                return True
        return False

    deleted = await asyncio.to_thread(_do_delete)
    if deleted:
        _scan_cache["files"] = None  # invalidate scan cache
        return {"deleted": filename}
    raise HTTPException(status_code=404, detail="File not found")
