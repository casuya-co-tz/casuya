"""Rehydrate ephemeral storage from the database.

The platform writes generated HTML (games, quizzes, compiled lessons) and
uploaded files to the local filesystem under ``settings.storage_root``. On
hosts with an ephemeral filesystem (e.g. Render Free) those files are wiped on
every restart/redeploy. This module restores them from the database, which is
the durable source of truth (see the ``package_html`` / ``data`` columns).
"""

from __future__ import annotations

from pathlib import Path

from backend.config.settings import get_settings
from backend.services.game_service import _get_game_pkg_path
from backend.services.quiz_service import _get_quiz_pkg_path


def rehydrate_storage() -> None:
    """Rewrite on-disk content from the database. Safe to call on every startup."""
    from sqlalchemy.orm import Session

    from backend.config.database import get_db
    from backend.models.file_record import FileRecord
    from backend.models.game import Game
    from backend.models.lesson import Lesson
    from backend.models.quiz import Quiz

    try:
        gen = get_db()
        db: Session = next(gen)
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: storage rehydration skipped, DB unavailable: {exc}")
        return

    try:
        settings = get_settings()
        storage = Path(settings.storage_root)

        # Games
        for game in db.query(Game).filter(Game.package_html.isnot(None)).all():
            if not game.slug:
                continue
            path = _get_game_pkg_path(game.slug)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(game.package_html, encoding="utf-8")

        # Quizzes
        for quiz in db.query(Quiz).filter(Quiz.package_html.isnot(None)).all():
            if not quiz.slug:
                continue
            path = _get_quiz_pkg_path(quiz.slug)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(quiz.package_html, encoding="utf-8")

        # Compiled lessons
        for lesson in (
            db.query(Lesson)
            .filter(Lesson.package_html.isnot(None), Lesson.package_filename.isnot(None))
            .all()
        ):
            path = storage / "lesson-packages" / lesson.package_filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(lesson.package_html, encoding="utf-8")

        # Uploaded files
        for record in db.query(FileRecord).filter(FileRecord.data.isnot(None)).all():
            path = storage / record.kind / record.filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(record.data)
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: storage rehydration partially failed: {exc}")
    finally:
        gen.close()
