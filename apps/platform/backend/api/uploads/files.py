"""File management routes — update metadata, serve and delete uploads."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from backend.api.uploads.common import FileUpdateRequest, _sanitize_filename, _scan_cache, logger
from backend.config.database import get_db
from backend.config.settings import get_settings
from backend.middleware.permissions import require_role
from backend.models.file_record import FileRecord

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.patch("/{filename:path}")
@router.patch("/{filename:path}/")
async def update_file(filename: str, body: FileUpdateRequest, current_user=Depends(require_role("admin"))):
    gen = get_db()
    db = next(gen)
    try:
        record = db.query(FileRecord).filter(FileRecord.filename == filename).first()
        if not record:
            # Do not create phantom DB records for files that don't exist.
            root = Path(get_settings().storage_root)
            found = any(
                (d / filename).is_file()
                for d in root.iterdir()
                if d.is_dir() and not d.name.startswith(".")
            )
            if not found:
                raise HTTPException(status_code=404, detail="File not found")
            db.add(FileRecord(filename=filename, display_name=filename, kind="documents", size=0, is_visible=True))
            db.flush()
            record = db.query(FileRecord).filter(FileRecord.filename == filename).first()
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
