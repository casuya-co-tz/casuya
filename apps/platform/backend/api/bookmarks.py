from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.services.bookmark_service import add_bookmark, is_bookmarked, list_bookmarks, remove_bookmark

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("")
@router.get("/")
def list_bookmarks_route(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return list_bookmarks(db, current_user["sub"], offset=offset, limit=limit)


@router.post("/{lesson_id}")
@router.post("/{lesson_id}/")
def add_bookmark_route(lesson_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return add_bookmark(db, current_user["sub"], lesson_id)


@router.delete("/{lesson_id}")
@router.delete("/{lesson_id}/")
def remove_bookmark_route(lesson_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return remove_bookmark(db, current_user["sub"], lesson_id)


@router.get("/{lesson_id}/status")
@router.get("/{lesson_id}/status/")
def bookmark_status_route(lesson_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return {"bookmarked": is_bookmarked(db, current_user["sub"], lesson_id)}
