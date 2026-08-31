from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from backend.config.database import get_db
from backend.models.lesson import Lesson, Subject, Subtopic, Topic
from backend.models.progress import ProgressRecord


def apply_progress_sync(student_id: str, payload: dict) -> dict:
    gen = get_db()
    db: Session = next(gen)
    try:
        existing = (
            db.query(ProgressRecord)
            .filter(
                ProgressRecord.student_id == student_id,
                ProgressRecord.lesson_id == payload["lesson_id"],
            )
            .first()
        )

        now = datetime.now(timezone.utc)
        new_completion = payload.get("completion_percentage", 0.0) or 0.0
        new_score = payload.get("score_percentage")

        if existing:
            existing.session_id = payload.get("session_id", existing.session_id)
            existing.elapsed_ms = max(existing.elapsed_ms, payload.get("elapsed_ms", 0))
            existing.completion_percentage = max(existing.completion_percentage, new_completion)
            if new_score is not None:
                existing.score_percentage = (
                    max(existing.score_percentage, new_score) if existing.score_percentage is not None else new_score
                )
            existing.synced_at = now
        else:
            record = ProgressRecord(
                student_id=student_id,
                lesson_id=payload["lesson_id"],
                session_id=payload["session_id"],
                elapsed_ms=payload.get("elapsed_ms", 0),
                completion_percentage=new_completion,
                score_percentage=new_score,
                synced_at=now,
            )
            db.add(record)

        db.commit()
        return {"student_id": student_id, "lesson_id": payload["lesson_id"], "status": "synced"}
    finally:
        gen.close()


def get_student_progress(student_id: str) -> list[dict]:
    gen = get_db()
    db: Session = next(gen)
    try:
        # Select only the columns we need instead of full ORM objects
        # to reduce data transfer and memory usage
        rows = (
            db.query(
                ProgressRecord.id,
                ProgressRecord.lesson_id,
                ProgressRecord.session_id,
                ProgressRecord.elapsed_ms,
                ProgressRecord.completion_percentage,
                ProgressRecord.score_percentage,
                ProgressRecord.synced_at,
                Lesson.title,
                Subject.name.label("subject_name"),
            )
            .join(Lesson, ProgressRecord.lesson_id == Lesson.id, isouter=True)
            .join(Subtopic, Lesson.subtopic_id == Subtopic.id, isouter=True)
            .join(Topic, Subtopic.topic_id == Topic.id, isouter=True)
            .join(Subject, Topic.subject_id == Subject.id, isouter=True)
            .filter(ProgressRecord.student_id == student_id)
            .all()
        )

        # Deduplicate by lesson_id — keep only the most recent record per lesson
        by_lesson = {}
        for r in rows:
            lid = r.lesson_id
            existing = by_lesson.get(lid)
            if not existing or (
                r.synced_at
                and existing.synced_at
                and r.synced_at > existing.synced_at
            ):
                by_lesson[lid] = r

        return [
            {
                "id": r.id,
                "lesson_id": r.lesson_id,
                "lesson_title": r.title or "Unknown",
                "subject_name": r.subject_name or "General",
                "session_id": r.session_id,
                "elapsed_ms": r.elapsed_ms,
                "completion_percentage": r.completion_percentage,
                "score_percentage": r.score_percentage,
                "synced_at": r.synced_at.isoformat() if r.synced_at else None,
            }
            for r in by_lesson.values()
        ]
    finally:
        gen.close()
