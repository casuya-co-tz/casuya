"""Upload ingestion — store the file, generate responsive variants and
record metadata in the database."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from backend.api.uploads.common import MAX_UPLOAD_SIZE, _generate_webp_variants, _scan_cache, logger
from backend.config.database import get_db
from backend.middleware.permissions import require_role
from backend.models.file_record import FileRecord
from backend.services.upload_service import store_upload

router = APIRouter(prefix="/uploads", tags=["uploads"])


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
