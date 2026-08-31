import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import bridge_auth, get_current_user
from backend.models.activity import RecentActivity
from backend.models.progress import ProgressRecord
from backend.models.student import Student
from backend.schemas.progress import ProgressSyncPayload
from backend.services.progress_service import apply_progress_sync, get_student_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["progress"])


def _resolve_student_id(current_user: dict, requested: str) -> str:
    """Resolve the student_id a caller is allowed to act on.

    Students may only act on their own record; admins/teachers may act on any.
    """
    role = current_user.get("role", "")
    if role in ("admin", "teacher"):
        return requested
    db: Session = next(get_db())
    try:
        student = db.query(Student).filter(Student.user_id == current_user["sub"]).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        return student.id
    finally:
        db.close()


# --- Activity recording (merged from activity.py) ---


class ActivityPayload(BaseModel):
    student_id: str
    lesson_id: str
    lesson_title: str = ""


@router.post("/activity")
@router.post("/activity/")
def record_activity(body: ActivityPayload, current_user=Depends(get_current_user)):
    """Record that a student viewed a lesson (server-side, replaces localStorage)."""
    student_id = _resolve_student_id(current_user, body.student_id)
    db: Session = next(get_db())
    try:
        record = RecentActivity(
            student_id=student_id,
            lesson_id=body.lesson_id,
            lesson_title=body.lesson_title,
            viewed_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()
        return {"status": "recorded"}
    except Exception as exc:
        logger.exception("Failed to record activity")
        db.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


def _do_sync(student_id: str, payload: dict):
    try:
        apply_progress_sync(student_id=student_id, payload=payload)
    except ValueError as exc:
        logger.warning("Progress sync rejected for student %s: %s", student_id, exc)
    except Exception:
        logger.exception("Progress sync failed for student %s", student_id)


@router.post("/sync", response_model=dict)
@router.post("/sync/", response_model=dict)
def sync_progress(body: ProgressSyncPayload, background_tasks: BackgroundTasks, current_user=Depends(bridge_auth)):
    role = current_user.get("role", "")
    student_id = body.student_id
    if role != "bridge":
        # JWT-authenticated users may only sync their own progress.
        student_id = _resolve_student_id(current_user, student_id)
    background_tasks.add_task(_do_sync, student_id=student_id, payload=body.model_dump())
    return {"status": "queued", "student_id": student_id, "lesson_id": body.lesson_id}


@router.get("/{student_id}/stats")
@router.get("/{student_id}/stats/")
def get_student_stats(student_id: str, current_user=Depends(get_current_user)):
    """Return server-side streak, lessons viewed count, average score, and recent lessons."""
    role = current_user.get("role", "")
    if role not in ("admin", "teacher"):
        owned = _resolve_student_id(current_user, "")  # throws if caller has no student profile
        if owned != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
    db: Session = next(get_db())
    try:
        now = datetime.now(timezone.utc)

        # --- Lessons viewed (distinct lessons) ---
        lessons_viewed = (
            db.query(func.count(func.distinct(RecentActivity.lesson_id)))
            .filter(RecentActivity.student_id == student_id)
            .scalar()
        ) or 0

        # --- Recent lessons (latest 20) ---
        recent_rows = (
            db.query(RecentActivity)
            .filter(RecentActivity.student_id == student_id)
            .order_by(RecentActivity.viewed_at.desc())
            .limit(20)
            .all()
        )
        seen = set()
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

        # --- Streak: count consecutive days with activity going back from today ---
        streak = 0
        if recent_rows:
            activity_dates = set()
            for r in recent_rows:
                activity_dates.add(r.viewed_at.date())

            check_date = now.date()
            for _ in range(365):
                if check_date in activity_dates:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break

        # --- Average score + subjects completed from a single aggregate scan ---
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
            "avgScore": round(avg_score) if avg_score else None,
            "subjectsCompleted": subjects_completed,
            "recent": recent_lessons,
        }
    finally:
        db.close()


@router.get("/{student_id}", response_model=list[dict])
@router.get("/{student_id}/", response_model=list[dict])
def get_student_progress_route(student_id: str, current_user=Depends(get_current_user)):
    role = current_user.get("role", "")
    if role not in ("admin", "teacher"):
        owned = _resolve_student_id(current_user, "")
        if owned != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
    return get_student_progress(student_id)
