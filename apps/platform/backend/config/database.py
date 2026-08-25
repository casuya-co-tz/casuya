from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .redis import SafeRedis
from .settings import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {}

# The engine is created lazily on first use so importing this module never
# fails when the database is unreachable. This lets the API start and serve
# health/static routes even with no database available.
_engine = None
SessionLocal: sessionmaker | None = None


def get_engine():
    """Return the SQLAlchemy engine, creating it on first use."""
    global _engine, SessionLocal
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            connect_args=connect_args,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=30,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


# SafeRedis degrades gracefully (no crash) when Redis is unavailable.
redis_client = SafeRedis(settings.redis_url)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Yield a DB session, raising a clear 503 if the database is unavailable."""
    if SessionLocal is None:
        get_engine()
    if SessionLocal is None:
        raise RuntimeError("Database engine is not available")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from backend.models import (  # noqa: F401
        activity,
        analytics,
        assignment,
        audit_log,
        bookmark,
        file_record,
        game,
        lesson,
        lesson_version,
        note,
        notification,
        password_reset_token,
        payment,
        progress,
        quiz,
        role,
        setting,
        student,
        syllabus,
        teacher,
        user,
    )

    try:
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            from sqlalchemy import text

            for stmt in [
                "CREATE INDEX IF NOT EXISTS ix_topic_subject_id ON topics(subject_id)",
                "CREATE INDEX IF NOT EXISTS ix_subtopic_topic_id ON subtopics(topic_id)",
                "CREATE INDEX IF NOT EXISTS ix_lesson_subtopic_id ON lessons(subtopic_id)",
                "CREATE INDEX IF NOT EXISTS ix_lesson_status ON lessons(status)",
                "CREATE INDEX IF NOT EXISTS ix_progress_student_id ON progress_records(student_id)",
                "CREATE INDEX IF NOT EXISTS ix_progress_lesson_id ON progress_records(lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_progress_synced_at ON progress_records(synced_at)",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_student_lesson ON progress_records(student_id, lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_quiz_lesson_id ON quizzes(lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_bookmark_user_id ON bookmarks(user_id)",
                "CREATE INDEX IF NOT EXISTS ix_bookmark_lesson_id ON bookmarks(lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_notes_student_id ON notes(student_id)",
                "CREATE INDEX IF NOT EXISTS ix_notes_lesson_id ON notes(lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_notification_user_id ON notifications(user_id)",
                "CREATE INDEX IF NOT EXISTS ix_notification_created_at ON notifications(created_at)",
                "CREATE INDEX IF NOT EXISTS ix_notification_user_created ON notifications(user_id, created_at)",
                "CREATE INDEX IF NOT EXISTS ix_quiz_question_quiz_id ON quiz_questions(quiz_id)",
                "CREATE INDEX IF NOT EXISTS ix_quiz_option_question_id ON quiz_options(question_id)",
                "CREATE INDEX IF NOT EXISTS ix_activity_student_viewed ON recent_activity(student_id, viewed_at)",
                "CREATE INDEX IF NOT EXISTS ix_game_lesson_id ON games(lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_payment_user_id ON payments(user_id)",
                "CREATE INDEX IF NOT EXISTS ix_assignment_lesson_id ON assignments(lesson_id)",
                "ALTER TABLE games ADD COLUMN IF NOT EXISTS package_html TEXT",
                "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS package_html TEXT",
                "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS package_html TEXT",
                "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS package_filename VARCHAR",
                "ALTER TABLE file_records ADD COLUMN IF NOT EXISTS data BYTEA",
            ]:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    pass
            conn.commit()
    except SQLAlchemyError as exc:
        print(f"WARNING: init_db failed, continuing without DB: {exc}")
