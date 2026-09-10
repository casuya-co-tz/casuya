"""Lesson service — package-path sharding and old-format migration."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.settings import get_settings
from backend.models.lesson import Lesson

settings = get_settings()


# ── Sharded package paths ──
def get_package_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "lesson-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"


def _migrate_old_package(slug: str) -> str | None:
    """Migrate old flat JSON or filesystem package to DB, return HTML content."""
    new_path = get_package_path(slug)
    if new_path.exists():
        try:
            html = new_path.read_text(encoding="utf-8")
            _backfill_content_to_db(slug, html)
            return html
        except Exception:
            pass

    old_path = Path(settings.storage_root) / "lesson-packages" / f"{slug}.json"
    if not old_path.exists():
        return None
    try:
        pkg = json.loads(old_path.read_text(encoding="utf-8"))
        html = pkg.get("html", "")
        new_path = get_package_path(slug)
        new_path.parent.mkdir(parents=True, exist_ok=True)
        new_path.write_text(html, encoding="utf-8")
        old_path.unlink()  # remove old format after migration
        _backfill_content_to_db(slug, html)
        return html
    except Exception:
        return None


def _backfill_content_to_db(slug: str, html: str) -> None:
    """Write filesystem content into the DB lesson row so future reads are DB-only."""
    try:
        _gen = get_db()
        db: Session = next(_gen)
        try:
            lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
            if lesson and not lesson.content:
                lesson.content = html
                db.commit()
        finally:
            _gen.close()
    except Exception:
        pass  # best-effort; filesystem fallback remains