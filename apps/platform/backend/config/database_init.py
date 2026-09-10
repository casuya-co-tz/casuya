"""Startup DB initialization — advisory/redis lock and DDL reconciliation."""

from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

_STARTUP_LOCK_KEY = "startup:init_db"
_STARTUP_ADVISORY_LOCK_ID = 73063015
_startup_lock_conn = None


def acquire_startup_lock(ttl: int = 300) -> bool:
    """Return True if this process owns the DB-init lock.

    Prefers a Postgres advisory lock (`pg_try_advisory_lock`), which is the
    only mechanism that safely serialises concurrent gunicorn workers when
    Redis is down or degraded. The advisory lock is session-scoped: it is
    held until unlocked or the connection closes.
    """
    global _startup_lock_conn
    from .database import get_engine, redis_client, settings
    if settings.database_url.startswith("postgres"):
        try:
            engine = get_engine()
            conn = engine.connect()
            ok = False
            try:
                from sqlalchemy import text

                ok = conn.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": _STARTUP_ADVISORY_LOCK_ID}).scalar()
                if ok:
                    _startup_lock_conn = conn  # hold session so the lock persists
                    return True
            finally:
                if not ok:
                    conn.close()
            return False
        except Exception:
            return True  # DB unreachable: allow init (degraded / single-worker).
    try:
        result = redis_client.set(_STARTUP_LOCK_KEY, "1", nx=True, ex=ttl)
        if result is not None:
            return bool(result)
        if not redis_client.available:
            return True  # Redis unreachable: allow init (single-worker / degraded).
        return False
    except Exception:
        return True


def release_startup_lock() -> None:
    """Release the startup lock for this process if it holds one."""
    global _startup_lock_conn
    from .database import redis_client, settings
    if settings.database_url.startswith("postgres"):
        try:
            if _startup_lock_conn is not None:
                from sqlalchemy import text

                _startup_lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _STARTUP_ADVISORY_LOCK_ID})
                _startup_lock_conn.commit()
                _startup_lock_conn.close()
                _startup_lock_conn = None
            return
        except Exception:
            pass
    try:
        redis_client.delete(_STARTUP_LOCK_KEY)
    except Exception:
        pass


def init_db() -> None:
    from backend.models import (  # noqa: F401
        activity,
        analytics,
        assignment,
        audit_log,
        bookmark,
        classroom,
        file_record,
        game,
        lesson,
        lesson_version,
        note,
        notification,
        password_reset_token,
        payment,
        payment_plan,
        progress,
        quiz,
        reference_doc,
        role,
        setting,
        student,
        syllabus,
        teacher,
        teacher_plan,
        user,
    )

    from .database import Base, get_engine

    try:
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            from sqlalchemy import inspect, text

            try:
                insp = inspect(engine)
                db_cols = {t: {c["name"] for c in insp.get_columns(t)} for t in insp.get_table_names()}
                for table in Base.metadata.tables.values():
                    if table.name not in db_cols:
                        continue
                    for col in table.columns:
                        if col.name in db_cols[table.name]:
                            continue
                        try:
                            with conn.begin_nested():
                                conn.execute(
                                    text(
                                        f"ALTER TABLE {table.name} "
                                        f"ADD COLUMN IF NOT EXISTS {col.name} "
                                        f"{col.type.compile(engine.dialect)}"
                                    )
                                )
                        except Exception as exc:
                            logger.warning(
                                "init_db: failed to add column %s.%s: %s",
                                table.name,
                                col.name,
                                exc,
                            )
            except Exception as exc:
                logger.exception("init_db: column reconciliation loop failed: %s", exc)

            is_postgres = engine.dialect.name == "postgresql"
            plan_id_alter = (
                "DO $$ BEGIN ALTER TABLE payments ADD COLUMN plan_id VARCHAR; "
                "EXCEPTION WHEN duplicate_column THEN NULL; END $$"
                if is_postgres
                else "ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_id VARCHAR"
            )
            plan_name_alter = (
                "DO $$ BEGIN ALTER TABLE payments ADD COLUMN plan_name VARCHAR; "
                "EXCEPTION WHEN duplicate_column THEN NULL; END $$"
                if is_postgres
                else "ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_name VARCHAR"
            )

            for stmt in [
                "CREATE INDEX IF NOT EXISTS ix_topic_subject_id ON topics(subject_id)",
            "CREATE INDEX IF NOT EXISTS ix_subtopic_topic_id ON subtopics(topic_id)",
            "CREATE INDEX IF NOT EXISTS ix_lesson_subtopic_id ON lessons(subtopic_id)",
            "CREATE INDEX IF NOT EXISTS ix_lesson_status ON lessons(status)",
            "CREATE INDEX IF NOT EXISTS ix_progress_student_id ON progress_records(student_id)",
            "CREATE INDEX IF NOT EXISTS ix_progress_lesson_id ON progress_records(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_progress_synced_at ON progress_records(synced_at)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_student_lesson ON progress_records(student_id, lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_progress_student_completion ON progress_records(student_id, completion_percentage)",
            "CREATE INDEX IF NOT EXISTS ix_progress_student_score ON progress_records(student_id, score_percentage)",
            "CREATE INDEX IF NOT EXISTS ix_user_role_active ON users(role, is_active)",
            "CREATE INDEX IF NOT EXISTS ix_student_school_code ON students(school_code)",
            "CREATE INDEX IF NOT EXISTS ix_lesson_version_lesson ON lesson_versions(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_lesson_analytics_lesson ON lesson_analytics_snapshots(lesson_id, generated_at)",
            "CREATE INDEX IF NOT EXISTS ix_assignment_submission_assignment ON assignment_submissions(assignment_id)",
            "CREATE INDEX IF NOT EXISTS ix_assignment_created_by ON assignments(created_by)",
            "CREATE INDEX IF NOT EXISTS ix_quiz_lesson_id ON quizzes(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_bookmark_user_id ON bookmarks(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_bookmark_lesson_id ON bookmarks(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_notes_user_id ON notes(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_notes_lesson_id ON notes(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_bookmark_user_lesson ON bookmarks(user_id, lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_notes_user_lesson ON notes(user_id, lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_student_user_id ON students(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_teacher_user_id ON teachers(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_teacher_school_code ON teachers(school_code)",
            "CREATE INDEX IF NOT EXISTS ix_notification_user_id ON notifications(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_notification_created_at ON notifications(created_at)",
            "CREATE INDEX IF NOT EXISTS ix_notification_user_created ON notifications(user_id, created_at)",
            "CREATE INDEX IF NOT EXISTS ix_quiz_question_quiz_id ON quiz_questions(quiz_id)",
            "CREATE INDEX IF NOT EXISTS ix_quiz_option_question_id ON quiz_options(question_id)",
            "CREATE INDEX IF NOT EXISTS ix_activity_student_viewed ON recent_activity(student_id, viewed_at)",
            "CREATE INDEX IF NOT EXISTS ix_game_lesson_id ON games(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_payment_user_id ON payments(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_assignment_lesson_id ON assignments(lesson_id)",
            "CREATE INDEX IF NOT EXISTS ix_notification_user_unread ON notifications(user_id, is_read)",
            "CREATE INDEX IF NOT EXISTS ix_assignment_submission_student ON assignment_submissions(student_id)",
            "CREATE INDEX IF NOT EXISTS ix_payment_status ON payments(status)",
            "CREATE INDEX IF NOT EXISTS ix_classroom_teacher_id ON classrooms(teacher_id)",
            "CREATE INDEX IF NOT EXISTS ix_classroom_code ON classrooms(code)",
            "CREATE INDEX IF NOT EXISTS ix_enrollment_classroom ON classroom_enrollments(classroom_id)",
            "CREATE INDEX IF NOT EXISTS ix_enrollment_student ON classroom_enrollments(student_id)",
            "CREATE INDEX IF NOT EXISTS ix_file_record_kind ON file_records(kind)",
            (
                "CREATE INDEX IF NOT EXISTS ix_lessons_title_fts "
                "ON lessons USING gin (to_tsvector('english', title))"
                if is_postgres
                else "-- noop"
            ),
            "ALTER TABLE games ADD COLUMN IF NOT EXISTS package_html TEXT",
            "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS package_html TEXT",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS package_html TEXT",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS package_filename VARCHAR",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_by VARCHAR",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS slug VARCHAR",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS package_version VARCHAR",
            "ALTER TABLE file_records ADD COLUMN IF NOT EXISTS data BYTEA",
                plan_id_alter,
                plan_name_alter,
            "DO $$ BEGIN ALTER TABLE students ADD COLUMN accessibility_prefs TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
        ]:
                try:
                    with conn.begin_nested():
                        conn.execute(text(stmt))
                except Exception as exc:
                    logger.warning("init_db: statement failed (%s...): %s", stmt.splitlines()[0][:80], exc)
    except SQLAlchemyError as exc:
        logger.warning("init_db failed, continuing without DB: %s", exc)