from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.bookmark import Bookmark
from backend.models.lesson import Lesson


def list_bookmarks(
    db: Session,
    user_id: str,
    offset: int = 0,
    limit: int = 50,
    max_limit: int = 100,
) -> dict:
    limit = min(limit, max_limit)
    total = db.query(func.count(Bookmark.id)).filter(Bookmark.user_id == user_id).scalar()
    rows = (
        db.query(Bookmark, Lesson.title)
        .join(Lesson, Bookmark.lesson_id == Lesson.id)
        .filter(Bookmark.user_id == user_id)
        .order_by(Bookmark.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": b.Bookmark.id,
                "lesson_id": b.Bookmark.lesson_id,
                "lesson_title": b.title,
                "created_at": b.Bookmark.created_at.isoformat() if b.Bookmark.created_at else None,
            }
            for b in rows
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + limit < total,
    }


def add_bookmark(db: Session, user_id: str, lesson_id: str) -> dict:
    existing = db.query(Bookmark).filter(Bookmark.user_id == user_id, Bookmark.lesson_id == lesson_id).first()
    if existing:
        return {"id": existing.id, "lesson_id": lesson_id, "status": "already_bookmarked"}
    bm = Bookmark(user_id=user_id, lesson_id=lesson_id)
    db.add(bm)
    db.commit()
    return {"id": bm.id, "lesson_id": lesson_id, "status": "bookmarked"}


def remove_bookmark(db: Session, user_id: str, lesson_id: str) -> dict:
    bm = db.query(Bookmark).filter(Bookmark.user_id == user_id, Bookmark.lesson_id == lesson_id).first()
    if bm:
        db.delete(bm)
        db.commit()
    return {"lesson_id": lesson_id, "status": "removed"}


def is_bookmarked(db: Session, user_id: str, lesson_id: str) -> bool:
    return db.query(Bookmark).filter(Bookmark.user_id == user_id, Bookmark.lesson_id == lesson_id).first() is not None
