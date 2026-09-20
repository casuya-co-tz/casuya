"""Lesson service — read lesson content from cache/DB/filesystem, fully rendered."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson
from backend.services.html_assets import rewrite_external_assets

from .cache import _cache_get, _cache_set
from .latex import _inject_katex
from .media import optimize_media
from .paths import _migrate_old_package, get_gzip_path
from .writer import write_content_gzip

_INLINE_SCRIPT_RE = re.compile(
    r"(<script\b(?![^>]*\bsrc\s*=)[^>]*>)([\s\S]*?)(</script>)",
    re.IGNORECASE,
)


def _neutralize_inline_script_closers(html: str) -> str:
    """Escape literal </script> inside inline scripts so HTML parsing cannot break them."""

    def _fix_block(match: re.Match[str]) -> str:
        open_tag, body, close = match.group(1), match.group(2), match.group(3)
        body = re.sub(r"</script>", r"<\\/script>", body, flags=re.IGNORECASE)
        return open_tag + body + close

    return _INLINE_SCRIPT_RE.sub(_fix_block, html)


def read_lesson_content(slug: str) -> str | None:
    cached = _cache_get(slug)
    if cached is not None:
        if not get_gzip_path(slug).exists():
            write_content_gzip(slug, cached)
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

    html = _neutralize_inline_script_closers(html)
    html = _inject_katex(html)
    html = optimize_media(html)
    html = rewrite_external_assets(html)
    _cache_set(slug, html)
    write_content_gzip(slug, html)
    return html