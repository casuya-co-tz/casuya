from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson
from backend.services.analytics_service import recompute_lesson_snapshot


def refresh_all_lesson_analytics():
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lessons = db.query(Lesson).filter(Lesson.status == "published").all()
        count = 0
        for lesson in lessons:
            recompute_lesson_snapshot(lesson.id)
            count += 1
        return count
    finally:
        _gen.close()
