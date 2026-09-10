from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


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

    from backend.config.database import Base, get_engine

    try:
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        # engine.begin() auto-commits the transaction when the block exits,
        # which reliably persists DDL (ALTER/INDEX) that connection reuse in
        # the pooled SQLAlchemy 2.0 connection otherwise leaves uncommitted.
        with engine.begin() as conn:
            from sqlalchemy import inspect, text

            # create_all never adds columns to an existing table. Reconcile
            # every column the models define (idempotent), so an evolved model
            # always matches the live schema regardless of when the table was
            # first created.
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
                # Composite indexes for frequent user+lesson lookups (P1)
                "CREATE INDEX IF NOT EXISTS ix_bookmark_user_lesson ON bookmarks(user_id, lesson_id)",
                "CREATE INDEX IF NOT EXISTS ix_notes_user_lesson ON notes(user_id, lesson_id)",
                # FK indexes for student/teacher user lookups (P1)
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
                # P2 #8: Missing indexes on hot query paths
                "CREATE INDEX IF NOT EXISTS ix_notification_user_unread ON notifications(user_id, is_read)",
                "CREATE INDEX IF NOT EXISTS ix_assignment_submission_student ON assignment_submissions(student_id)",
                "CREATE INDEX IF NOT EXISTS ix_payment_status ON payments(status)",
                "CREATE INDEX IF NOT EXISTS ix_classroom_teacher_id ON classrooms(teacher_id)",
                "CREATE INDEX IF NOT EXISTS ix_classroom_code ON classrooms(code)",
                "CREATE INDEX IF NOT EXISTS ix_enrollment_classroom ON classroom_enrollments(classroom_id)",
                "CREATE INDEX IF NOT EXISTS ix_enrollment_student ON classroom_enrollments(student_id)",
                "CREATE INDEX IF NOT EXISTS ix_file_record_kind ON file_records(kind)",
                # Full-text search: functional GIN index over to_tsvector(title).
                # Postgres-only (SQLite tests fall back to LIKE in search_service).
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
                # PostgreSQL does not support IF NOT EXISTS for ADD COLUMN.
                # Use a DO block so the migration is idempotent.
                "DO $$ BEGIN ALTER TABLE students ADD COLUMN accessibility_prefs TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$",
            ]:
                # Run each statement in its own savepoint so a single failure
                # (e.g. a missing column on an older schema) cannot abort the
                # transaction and prevent the remaining ALTERs from applying.
                try:
                    with conn.begin_nested():
                        conn.execute(text(stmt))
                except Exception as exc:
                    logger.warning("init_db: statement failed (%s...): %s", stmt.splitlines()[0][:80], exc)
    except SQLAlchemyError as exc:
        logger.warning("init_db failed, continuing without DB: %s", exc)