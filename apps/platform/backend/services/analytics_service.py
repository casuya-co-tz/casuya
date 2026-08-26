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
        total_students = db.query(Student).count()
        total_teachers = db.query(Teacher).count()
        total_lessons = db.query(Lesson).filter(Lesson.status == "published").count()
        total_subjects = db.query(Subject).count()
        total_quizzes = db.query(Quiz).count()
        total_sessions = db.query(ProgressRecord).count()
        avg_completion = db.query(func.avg(ProgressRecord.completion_percentage)).scalar() or 0.0
        return {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_lessons": total_lessons,
            "total_subjects": total_subjects,
            "total_quizzes": total_quizzes,
            "total_sessions": total_sessions,
            "avg_completion_rate": round(float(avg_completion), 2),
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
