import os
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

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_KINDS = {"images", "videos", "audio", "documents"}


class FileUpdateRequest(BaseModel):
    display_name: str | None = None
    is_visible: bool | None = None


def _scan_files() -> list[dict]:
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
    files.sort(key=lambda x: x.get("uploaded_at", 0), reverse=True)
    return files


def _merge_with_db_meta(files: list[dict]) -> list[dict]:
    """Enrich filesystem scan results with DB metadata (display_name, is_visible)."""
    gen = get_db()
    db = next(gen)
    try:
        records = db.query(FileRecord).all()
        meta_map = {r.filename: r for r in records}
        result = []
        for f in files:
            rec = meta_map.get(f["filename"])
            f["display_name"] = rec.display_name if rec else f["filename"]
            f["is_visible"] = rec.is_visible if rec else True
            if rec:
                f["id"] = rec.id
            result.append(f)
        return result
    except Exception:
        return files
    finally:
        gen.close()


@router.get("")
@router.get("/")
async def list_files(current_user=Depends(require_role("admin"))):
    files = _scan_files()
    return _merge_with_db_meta(files)


@router.get("/public")
@router.get("/public/")
async def list_files_public():
    files = _scan_files()
    enriched = _merge_with_db_meta(files)
    return [f for f in enriched if f.get("is_visible", True)]


@router.post("")
@router.post("/")
async def upload_file(file: UploadFile, current_user=Depends(require_role("admin"))):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
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
    content = await file.read()
    stored_name = store_upload(content, file.filename, kind)

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
    except Exception:
        pass
    finally:
        gen.close()

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
    settings = get_settings()
    root = Path(settings.storage_root)
    for kind_dir in root.iterdir() if root.exists() else []:
        if not kind_dir.is_dir():
            continue
        target = kind_dir / filename
        if target.exists() and target.is_file():
            return FileResponse(target, filename=filename)

    # Fallback: serve from the database if the file was wiped from disk.
    gen = get_db()
    db = next(gen)
    try:
        record = db.query(FileRecord).filter(FileRecord.filename == filename).first()
        if record is not None and record.data is not None:
            from fastapi.responses import Response

            return Response(content=record.data, media_type="application/octet-stream")
    finally:
        gen.close()
    raise HTTPException(status_code=404, detail="File not found")


@router.delete("/{filename:path}")
@router.delete("/{filename:path}/")
async def delete_file(filename: str, current_user=Depends(require_role("admin"))):
    settings = get_settings()
    root = Path(settings.storage_root)
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
            except Exception:
                pass
            finally:
                gen.close()
            return {"deleted": filename}
    raise HTTPException(status_code=404, detail="File not found")
