from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config.database import get_db, get_read_db
from backend.middleware.auth import get_current_user
from backend.middleware.cache import cache_get, cache_invalidate, cache_set, etag_for
from backend.middleware.permissions import require_role
from backend.schemas.lessons import LessonCreate, LessonResponse, LessonUpdate
from backend.services.lesson_service import (
    create_lesson_from_html,
    delete_lesson,
    get_lesson,
    get_lesson_package,
    get_package_path,
    list_lessons,
    publish_lesson,
    read_lesson_content,
    update_lesson,
)
from integrations.cloudflare import purge_cache_tags

router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.get("")
@router.get("/")
def list_lessons_route(
    subtopic_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
):
    skip = max(0, skip)
    limit = min(max(1, limit), 200)  # cap so a single request can't pull the whole table
    cache_key = f"lessons:list:{subtopic_id or ''}:{status or ''}:{skip}:{limit}"
    cached = cache_get(cache_key, ttl_seconds=120)
    if cached is not None:
        return cached
    result = list_lessons(subtopic_id=subtopic_id, status=status, skip=skip, limit=limit)
    cache_set(cache_key, result, ttl=120)
    return result


@router.get("/{lesson_id}")
@router.get("/{lesson_id}/")
def get_lesson_route(lesson_id: str, current_user=Depends(get_current_user)):
    cache_key = f"lessons:detail:{lesson_id}"
    cached = cache_get(cache_key, ttl_seconds=120)
    if cached is not None:
        return cached
    lesson = get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    cache_set(cache_key, lesson, ttl=120)
    return lesson


@router.get("/{lesson_id}/content")
@router.get("/{lesson_id}/content/")
def get_lesson_content_route(lesson_id: str, request: Request, current_user=Depends(get_current_user)):
    lesson = get_lesson(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    slug = lesson["slug"]
    html = read_lesson_content(slug)
    if html is None:
        raise HTTPException(status_code=404, detail="Lesson content not found")
    # Lessons change rarely. Cache at the browser/CDN edge for an hour, and serve
    # a stale copy instantly while revalidating for up to a day (so a student on
    # 3G gets the lesson immediately even after an edit). The content hash lets
    # clients detect changes; the backend also invalidates its Redis copy on edit.
    headers = {
        "X-Content-Hash": lesson.get("content_hash", ""),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Cache-Tag": "lesson-content",
    }
    return HTMLResponse(content=html, headers=headers)


@router.get("/{lesson_id}/package")
@router.get("/{lesson_id}/package/")
def get_lesson_package_route(
    lesson_id: str, db: Session = Depends(get_read_db), current_user=Depends(get_current_user)
):
    """Aggregate the per-lesson metadata a student screen needs into ONE call.

    Opening a lesson used to fire ~5 requests (detail, bookmark, note, quiz,
    games) plus the separately-cached content fetch. This collapses the mutable
    metadata into a single round-trip (P2-3). The heavy HTML *content* is
    deliberately kept on its own cached/prefetched endpoint so it stays
    edge-cacheable and is not duplicated inside this JSON.

    Uses optimized get_lesson_package() which fires only 3 DB queries instead of 7.
    """
    pkg = get_lesson_package(lesson_id, current_user["sub"], db)
    if not pkg:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return pkg


@router.post("", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.post("/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def create_lesson_route(body: LessonCreate):
    try:
        result = create_lesson_from_html(
            subtopic_id=body.subtopic_id,
            title=body.title,
            html=body.html_content,
        )
        cache_invalidate("lessons:")
        purge_cache_tags(["lesson-content"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{lesson_id}/publish", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.post("/{lesson_id}/publish/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def publish_lesson_route(lesson_id: str):
    try:
        result = publish_lesson(lesson_id)
        cache_invalidate("lessons:")
        purge_cache_tags(["lesson-content"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{lesson_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{lesson_id}/", dependencies=[Depends(require_role("admin"))])
def delete_lesson_route(lesson_id: str):
    try:
        result = delete_lesson(lesson_id)
        cache_invalidate("lessons:")
        purge_cache_tags(["lesson-content"])
        return result
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Lesson cannot be deleted due to database constraints")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{lesson_id}", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.put("/{lesson_id}/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def update_lesson_route(lesson_id: str, body: LessonUpdate):
    try:
        result = update_lesson(
            lesson_id=lesson_id,
            title=body.title,
            html=body.html_content,
        )
        cache_invalidate("lessons:")
        purge_cache_tags(["lesson-content"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
