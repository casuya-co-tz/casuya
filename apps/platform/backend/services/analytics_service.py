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
    from backend.models.student import Student
    from backend.models.teacher import Teacher

    gen = get_db()
    db: Session = next(gen)
    try:
        total_students = db.query(Student).count()
        total_teachers = db.query(Teacher).count()
        total_lessons = db.query(Lesson).filter(Lesson.status == "published").count()
        total_subjects = db.query(Subject).count()
        total_sessions = db.query(ProgressRecord).count()
        avg_completion = db.query(func.avg(ProgressRecord.completion_percentage)).scalar() or 0.0
        return {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_lessons": total_lessons,
            "total_subjects": total_subjects,
            "total_sessions": total_sessions,
            "avg_completion_rate": round(float(avg_completion), 2),
        }
    finally:
        gen.close()


def get_lesson_distribution() -> list[dict]:
    from backend.models.lesson import Lesson, Subject, Subtopic, Topic

    gen = get_db()
    db: Session = next(gen)
    try:
        rows = (
            db.query(
                Subject.id,
                Subject.name,
                func.count(Lesson.id).label("lesson_count"),
                func.avg(ProgressRecord.completion_percentage).label("avg_completion"),
            )
            .select_from(Subject)
            .join(Topic, Topic.subject_id == Subject.id)
            .join(Subtopic, Subtopic.topic_id == Topic.id)
            .join(Lesson, Lesson.subtopic_id == Subtopic.id)
            .outerjoin(ProgressRecord, Lesson.id == ProgressRecord.lesson_id)
            .filter(Lesson.status == "published")
            .group_by(Subject.id, Subject.name)
            .order_by(func.count(Lesson.id).desc())
            .all()
        )
        if not rows:
            return []
        return [
            {
                "subject": r.name,
                "subject_id": r.id,
                "count": int(r.lesson_count or 0),
                "avg_completion_percentage": round(float(r.avg_completion or 0.0), 1),
            }
            for r in rows
        ]
    finally:
        gen.close()
