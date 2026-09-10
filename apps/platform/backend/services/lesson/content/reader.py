"""Lesson service — read lesson content from cache/DB/filesystem, fully rendered."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson
from backend.services.html_assets import rewrite_external_assets

from .cache import _cache_get, _cache_set
from .latex import _inject_katex
from .media import optimize_media
from .paths import _migrate_old_package


def read_lesson_content(slug: str) -> str | None:
    cached = _cache_get(slug)
    if cached is not None:
        return cached

    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
        if lesson and lesson.content:
            html = lesson.content
        else:
            html = _migrate_old_package(slug)
            if html is None:
                return None
    finally:
        _gen.close()

    html = _inject_katex(html)
    html = optimize_media(html)
    html = rewrite_external_assets(html)
    _cache_set(slug, html)
    return html