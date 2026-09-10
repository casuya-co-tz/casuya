"""Upload API — list, upload, update, serve and delete files."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.uploads import files, list, upload
from backend.api.uploads.common import FileUpdateRequest

router = APIRouter(tags=["uploads"])

router.include_router(list.router)
router.include_router(upload.router)
router.include_router(files.router)

__all__ = ["router", "FileUpdateRequest"]
