from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .redis import SafeRedis
from .settings import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {}

# Neon/Postgres connection budget. Neon enforces a hard per-instance
# connection allowance (often ~10-30) and aggressively recycles idle
# backends. A large fixed pool (e.g. 10+20 per process) can exceed that
# budget when several workers run, so we keep the pool small. When using
# Neon's *pooled* (PgBouncer-multiplexed) connection string this simply
# marks how many simultaneous DB calls each process may make and stays well
# inside Neon's allowance. pool_pre_ping validates stale pooled connections
# and a short pool_recycle matches Neon's idle-recycling of backends.
POOL_SIZE = 5
POOL_MAX_OVERFLOW = 10
POOL_RECYCLE = 300  # seconds (Neon recycles idle connections ~5 min)
POOL_TIMEOUT = 5  # seconds; fail fast rather than stacking stalled requests

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
            pool_size=POOL_SIZE,
            max_overflow=POOL_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=POOL_RECYCLE,
            pool_timeout=POOL_TIMEOUT,
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


# Read replica (P3-2). When DATABASE_REPLICA_URL is set, read-only endpoints use
# it to scale reads off the primary. Falls back to the primary when unset, so
# single-instance deployments need no config.
_replica_engine = None
ReplicaSessionLocal = None


def _connect_args_for(url: str) -> dict:
    return {"check_same_thread": False, "timeout": 30} if url.startswith("sqlite") else {}


def get_replica_engine():
    global _replica_engine, ReplicaSessionLocal
    if _replica_engine is None and settings.database_replica_url:
        _replica_engine = create_engine(
            settings.database_replica_url,
            connect_args=_connect_args_for(settings.database_replica_url),
            pool_size=POOL_SIZE,
            max_overflow=POOL_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=POOL_RECYCLE,
            pool_timeout=POOL_TIMEOUT,
        )
        ReplicaSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_replica_engine)
    return _replica_engine


def get_read_db() -> Generator[Session, None, None]:
    """Yield a read-replica session if configured, else the primary."""
    if ReplicaSessionLocal is None:
        get_replica_engine()
    if ReplicaSessionLocal is not None:
        db = ReplicaSessionLocal()
        try:
            yield db
        finally:
            db.close()
        return
    yield from get_db()


# Lock so that when multiple gunicorn workers start simultaneously, only one
# process runs the DDL reconciliation in init_db. Without this, concurrent
# create_all/ALTER could race. Falls back to "proceed" when Redis is down (dev).
_STARTUP_LOCK_KEY = "startup:init_db"


def acquire_startup_lock(ttl: int = 300) -> bool:
    """Return True if this process owns the DB-init lock (Redis SET NX EX)."""
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
            from sqlalchemy import inspect, text

            # create_all never adds columns to an existing table. Reconcile
            # every column the models define (idempotent), so an evolved model
            # always matches the live schema regardless of when the table was
            # first created.
            try:
                insp = inspect(engine)
                db_cols = {t: {c["name"] for c in insp.get_columns(t)} for t in insp.get_table_names()}
                for table in Base.metadata.sorted_tables:
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
                        except Exception:
                            pass
            except Exception:
                pass

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
                except Exception:
                    pass
        conn.commit()
    except SQLAlchemyError as exc:
        print(f"WARNING: init_db failed, continuing without DB: {exc}")
