"""Services Bridge — media package routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.middleware.auth import get_current_user
from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


@router.post("/media/upload")
@router.post("/media/upload/")
def upload_media(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.upload_media(payload))


@router.get("/media")
@router.get("/media/")
def list_media(lesson_id: str | None = None, school_id: str | None = None, _=Depends(get_current_user)):
    params: dict = {}
    if lesson_id:
        params["lessonId"] = lesson_id
    if school_id:
        params["schoolId"] = school_id
    return _guard(lambda: _bridge.list_media(params))


@router.get("/media/{media_id}")
@router.get("/media/{media_id}/")
def get_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_media(media_id))


@router.delete("/media/{media_id}")
@router.delete("/media/{media_id}/")
def delete_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.delete_media(media_id))


@router.get("/media/{media_id}/deliver")
@router.get("/media/{media_id}/deliver/")
def deliver_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.deliver_media(media_id))


@router.post("/media/{media_id}/thumbnail")
@router.post("/media/{media_id}/thumbnail/")
def media_thumbnail(media_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.media_thumbnail(media_id, payload))


@router.get("/media/stats")
@router.get("/media/stats/")
def media_stats(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.media_stats())


@router.post("/media/search")
@router.post("/media/search/")
def search_media(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.search_media(payload))