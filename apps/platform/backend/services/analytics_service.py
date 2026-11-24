from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.analytics import LessonAnalyticsSnapshot
from backend.models.progress import ProgressRecord


def _get_db():
    gen = get_db()
    db = next(gen)
    return db, gen


def recompute_lesson_snapshot(lesson_id: str) -> dict:
    db, gen = _get_db()
    try:
        stats = (
            db.query(
                func.count(ProgressRecord.id),
                func.avg(ProgressRecord.completion_percentage),
                func.avg(ProgressRecord.score_percentage),
            )
            .filter(ProgressRecord.lesson_id == lesson_id)
            .first()
        )
        session_count = stats[0] or 0
        avg_completion = float(stats[1] or 0.0)
        avg_score = float(stats[2] or 0.0)
        snapshot = LessonAnalyticsSnapshot(
            lesson_id=lesson_id,
            session_count=session_count,
            avg_completion_percentage=round(avg_completion, 2),
            avg_score_percentage=round(avg_score, 2),
            generated_at=datetime.now(timezone.utc),
        )
        db.add(snapshot)
        db.commit()
        return {
            "lesson_id": lesson_id,
            "session_count": session_count,
            "avg_completion_percentage": round(avg_completion, 2),
            "avg_score_percentage": round(avg_score, 2),
        }
    finally:
        gen.close()


def recompute_snapshots_for_lessons(db: Session, lesson_ids: list[str]) -> int:
    """Recompute snapshots for many lessons in one session and two queries.

    The batch refresh task used to call :func:`recompute_lesson_snapshot` per
    lesson, which opened a fresh DB session, ran a COUNT/AVG query and committed
    separately for every row (an N+1 pattern). This version groups all progress
    aggregation into a single query and inserts all snapshots in one commit.
    """
    if not lesson_ids:
        return 0
    rows = (
        db.query(
            ProgressRecord.lesson_id,
            func.count(ProgressRecord.id),
            func.avg(ProgressRecord.completion_percentage),
            func.avg(ProgressRecord.score_percentage),
        )
        .filter(ProgressRecord.lesson_id.in_(lesson_ids))
        .group_by(ProgressRecord.lesson_id)
        .all()
    )
    stats = {r[0]: r for r in rows}
    generated_at = datetime.now(timezone.utc)
    snapshots = []
    for lesson_id in lesson_ids:
        row = stats.get(lesson_id)
        snapshots.append(
            LessonAnalyticsSnapshot(
                lesson_id=lesson_id,
                session_count=int(row[1] or 0) if row else 0,
                avg_completion_percentage=round(float(row[2] or 0.0), 2) if row else 0.0,
                avg_score_percentage=round(float(row[3] or 0.0), 2) if row else 0.0,
                generated_at=generated_at,
            )
        )
    db.add_all(snapshots)
    db.commit()
    return len(snapshots)


def get_lesson_analytics(lesson_id: str) -> dict | None:
    db, gen = _get_db()
    try:
        snapshot = (
            db.query(LessonAnalyticsSnapshot)
            .filter(LessonAnalyticsSnapshot.lesson_id == lesson_id)
            .order_by(LessonAnalyticsSnapshot.generated_at.desc())
            .first()
        )
        if not snapshot:
            return None
        return {
            "lesson_id": snapshot.lesson_id,
            "session_count": snapshot.session_count,
            "avg_completion_percentage": snapshot.avg_completion_percentage,
            "avg_score_percentage": snapshot.avg_score_percentage,
        }
    finally:
        gen.close()


def get_platform_overview() -> dict:
    from backend.models.lesson import Lesson, Subject
    from backend.models.quiz import Quiz
    from backend.models.student import Student
    from backend.models.teacher import Teacher

    gen = get_db()
    db: Session = next(gen)
    try:
        # Use scalar subqueries to get all counts in a single round-trip
        # instead of 7 separate COUNT queries
        student_count = db.query(func.count(Student.id)).scalar_subquery()
        teacher_count = db.query(func.count(Teacher.id)).scalar_subquery()
        lesson_count = db.query(func.count(Lesson.id)).filter(Lesson.status == "published").scalar_subquery()
        subject_count = db.query(func.count(Subject.id)).scalar_subquery()
        quiz_count = db.query(func.count(Quiz.id)).scalar_subquery()
        session_count = db.query(func.count(ProgressRecord.id)).scalar_subquery()
        avg_completion = db.query(func.avg(ProgressRecord.completion_percentage)).scalar_subquery()

        row = db.query(
            student_count,
            teacher_count,
            lesson_count,
            subject_count,
            quiz_count,
            session_count,
            avg_completion,
        ).first()

        return {
            "total_students": row[0] if row else 0,
            "total_teachers": row[1] if row else 0,
            "total_lessons": row[2] if row else 0,
            "total_subjects": row[3] if row else 0,
            "total_quizzes": row[4] if row else 0,
            "total_sessions": row[5] if row else 0,
            "avg_completion_rate": round(float(row[6] or 0), 2) if row else 0.0,
        }
    finally:
        gen.close()


def get_lesson_distribution() -> list[dict]:
    from backend.models.lesson import Lesson

    gen = get_db()
    db: Session = next(gen)
    try:
        rows = (
            db.query(
                Lesson.id,
                Lesson.title,
                func.count(ProgressRecord.id).label("session_count"),
                func.avg(ProgressRecord.completion_percentage).label("avg_completion"),
            )
            .select_from(Lesson)
            .outerjoin(ProgressRecord, Lesson.id == ProgressRecord.lesson_id)
            .group_by(Lesson.id, Lesson.title)
            .order_by(func.count(ProgressRecord.id).desc())
            .all()
        )
        if not rows:
            return []
        return [
            {
                "lesson_title": r.title,
                "session_count": int(r.session_count or 0),
                "avg_completion_percentage": round(float(r.avg_completion or 0.0), 1),
            }
            for r in rows
        ]
    finally:
        gen.close()
