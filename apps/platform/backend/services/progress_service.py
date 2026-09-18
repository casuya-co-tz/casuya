import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.activity import RecentActivity
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

        snapshot = None
        if payload.get("elements") is not None:
            elements = payload["elements"]
            if isinstance(elements, list) and len(elements) > 80:
                elements = elements[-80:]
            snapshot = json.dumps(
                {"step": payload.get("step") or 1, "elements": elements},
                separators=(",", ":"),
            )
            if len(snapshot) > 200_000:
                snapshot = json.dumps(
                    {"step": payload.get("step") or 1, "elements": [], "truncated": True},
                    separators=(",", ":"),
                )

        if existing:
            if payload.get("session_id"):
                existing.session_id = payload["session_id"]
            existing.elapsed_ms = max(existing.elapsed_ms, payload.get("elapsed_ms", 0))
            existing.completion_percentage = max(existing.completion_percentage, new_completion)
            if new_score is not None:
                existing.score_percentage = (
                    max(existing.score_percentage, new_score) if existing.score_percentage is not None else new_score
                )
            if snapshot is not None:
                existing.blackboard_snapshot = snapshot
            existing.synced_at = now
        else:
            record = ProgressRecord(
                student_id=student_id,
                lesson_id=payload["lesson_id"],
                session_id=payload.get("session_id") or "sync",
                elapsed_ms=payload.get("elapsed_ms", 0),
                completion_percentage=new_completion,
                score_percentage=new_score,
                blackboard_snapshot=snapshot,
                synced_at=now,
            )
            db.add(record)

        db.commit()
        return {"student_id": student_id, "lesson_id": payload["lesson_id"], "status": "synced"}
    finally:
        gen.close()


def get_student_progress(student_id: str, *, offset: int = 0, limit: int = 200) -> dict:
    gen = get_db()
    db: Session = next(gen)
    try:
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

        items = [
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
        total = len(items)
        page = items[offset : offset + limit]
        return {"items": page, "total": total, "offset": offset, "limit": limit}
    finally:
        gen.close()


def get_lesson_progress(student_id: str, lesson_id: str) -> dict | None:
    gen = get_db()
    db: Session = next(gen)
    try:
        record = (
            db.query(ProgressRecord)
            .filter(
                ProgressRecord.student_id == student_id,
                ProgressRecord.lesson_id == lesson_id,
            )
            .first()
        )
        if not record or not record.blackboard_snapshot:
            return None
        data = json.loads(record.blackboard_snapshot)
        if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
            return None
        return data
    finally:
        gen.close()


def compute_student_stats(db: Session, student_id: str) -> dict:
    """Streak, lessons viewed, average score, and recent lessons for a student."""
    now = datetime.now(timezone.utc)

    lessons_viewed = (
        db.query(func.count(func.distinct(RecentActivity.lesson_id)))
        .filter(RecentActivity.student_id == student_id)
        .scalar()
    ) or 0

    recent_rows = (
        db.query(RecentActivity)
        .filter(RecentActivity.student_id == student_id)
        .order_by(RecentActivity.viewed_at.desc())
        .limit(20)
        .all()
    )
    seen: set[str] = set()
    recent_lessons = []
    for r in recent_rows:
        if r.lesson_id not in seen:
            seen.add(r.lesson_id)
            recent_lessons.append(
                {
                    "id": r.lesson_id,
                    "title": r.lesson_title,
                    "viewedAt": int(r.viewed_at.timestamp() * 1000),
                }
            )

    streak = 0
    recent_dates = (
        db.query(func.date(RecentActivity.viewed_at))
        .filter(RecentActivity.student_id == student_id)
        .filter(RecentActivity.viewed_at >= now - timedelta(days=365))
        .distinct()
        .all()
    )
    if recent_dates:
        activity_dates = {d[0] for d in recent_dates}
        check_date = now.date()
        for _ in range(365):
            if check_date in activity_dates:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break

    avg_score, subjects_completed = (
        db.query(
            func.avg(ProgressRecord.score_percentage).filter(
                ProgressRecord.score_percentage.isnot(None),
                ProgressRecord.score_percentage > 0,
            ),
            func.count(func.distinct(ProgressRecord.lesson_id)).filter(
                ProgressRecord.completion_percentage >= 100,
            ),
        )
        .filter(ProgressRecord.student_id == student_id)
        .first()
    )
    avg_score = round(avg_score) if avg_score is not None else None
    subjects_completed = subjects_completed or 0

    return {
        "streak": streak,
        "lessonsViewed": lessons_viewed,
        "avgScore": avg_score,
        "subjectsCompleted": subjects_completed,
        "recent": recent_lessons,
    }
