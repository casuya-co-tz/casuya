from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson
from backend.services.analytics_service import recompute_snapshots_for_lessons


def refresh_all_lesson_analytics():
    """Refresh analytics snapshots for all published lessons.

    Previously this opened one DB session per lesson via
    ``recompute_lesson_snapshot``. The batched helper aggregates every lesson's
    progress in a single grouped query and writes all snapshots in one commit.
    """
    gen = get_db()
    db: Session = next(gen)
    try:
        lesson_ids = [row.id for row in db.query(Lesson.id).filter(Lesson.status == "published").all()]
        return recompute_snapshots_for_lessons(db, lesson_ids)
    finally:
        gen.close()
