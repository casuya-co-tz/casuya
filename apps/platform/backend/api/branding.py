"""Site branding endpoints — upload / serve / delete logo and favicon."""

from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.config.settings import get_settings
from backend.middleware.permissions import require_role

router = APIRouter(prefix="/branding", tags=["branding"])
settings = get_settings()

BRANDING_DIR = Path(settings.storage_root) / "branding"
BRANDING_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "svg", "ico", "webp"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB

# Default favicon SVG (bird)
DEFAULT_FAVICON = Path(__file__).resolve().parent.parent.parent / "frontend" / "assets" / "images" / "casuya-logo.svg"


def _branding_path(kind: str) -> Path:
    """Return the canonical path for a branding asset (logo or favicon)."""
    return BRANDING_DIR / kind


@router.get("/favicon.ico")
def serve_favicon_ico():
    """Serve the favicon when the browser requests /favicon.ico."""
    path = _branding_path("favicon")
    if path.exists():
        return FileResponse(path, media_type="image/png")
    if DEFAULT_FAVICON.exists():
        return FileResponse(DEFAULT_FAVICON, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="No favicon")


@router.get("/{kind}")
def serve_branding(kind: str):
    """Serve the current logo or favicon. Returns 404 if not uploaded."""
    if kind not in ("logo", "favicon"):
        raise HTTPException(status_code=400, detail="Kind must be 'logo' or 'favicon'")
    path = _branding_path(kind)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not uploaded")
    mediatypes = {
        "logo": "image/png",
        "favicon": "image/png",
    }
    return FileResponse(path, media_type=mediatypes.get(kind, "application/octet-stream"))


@router.post("/{kind}")
async def upload_branding(kind: str, file: UploadFile, _admin=Depends(require_role("admin"))):
    """Upload or replace a branding asset (logo or favicon)."""
    if kind not in ("logo", "favicon"):
        raise HTTPException(status_code=400, detail="Kind must be 'logo' or 'favicon'")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 2 MB)")

    # Save as predictable filename so the URL never changes
    dest = BRANDING_DIR / kind
    dest.write_bytes(content)
    return {"kind": kind, "size": len(content), "filename": file.filename}


@router.delete("/{kind}")
def delete_branding(kind: str, _admin=Depends(require_role("admin"))):
    """Delete a branding asset, reverting to the default."""
    if kind not in ("logo", "favicon"):
        raise HTTPException(status_code=400, detail="Kind must be 'logo' or 'favicon'")
    path = _branding_path(kind)
    if path.exists():
        path.unlink()
    return {"kind": kind, "deleted": True}
