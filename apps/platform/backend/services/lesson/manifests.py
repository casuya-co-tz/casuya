"""Lesson manifests for casuya-bridge offline sync."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson


def list_lesson_manifests(
    *,
    skip: int = 0,
    limit: int = 500,
    created_by: str | None = None,
    status: str = "published",
) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(Lesson.id, Lesson.slug, Lesson.title, Lesson.content_hash, Lesson.status)
        if status:
            query = query.filter(Lesson.status == status)
        if created_by:
            query = query.filter(Lesson.created_by == created_by)
        rows = query.offset(skip).limit(limit).all()
        return [
            {
                "id": r.id,
                "slug": r.slug,
                "title": r.title,
                "content_hash": r.content_hash or "",
                "status": r.status,
            }
            for r in rows
        ]
    finally:
        _gen.close()
