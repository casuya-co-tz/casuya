import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.config.settings import get_settings
from backend.models.lesson import Lesson


def get_runtime_manifest(lesson_id: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")
        settings = get_settings()
        package_path = Path(settings.storage_root) / "lesson-packages" / f"{lesson.slug}.json"
        if not package_path.exists():
            raise FileNotFoundError(f"Package not found for lesson {lesson_id}")
        with open(package_path) as f:
            package = json.load(f)
        return {
            "lesson_id": lesson.id,
            "slug": lesson.slug,
            "title": lesson.title,
            "content_hash": package.get("content_hash"),
            "package_version": package.get("package_version"),
            "signature": package.get("signature"),
            "package_url": f"/storage/lesson-packages/{lesson.slug}.json",
        }
    finally:
        _gen.close()
