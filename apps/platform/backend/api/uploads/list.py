"""Upload listing routes — admin file browser and public visible files."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.uploads.common import _merge_with_db_meta, _scan_files
from backend.middleware.permissions import require_role

router = APIRouter(prefix="/uploads", tags=["uploads"])


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
