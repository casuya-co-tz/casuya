import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import bridge_auth, get_current_user
from backend.models.activity import RecentActivity
from backend.models.student import Student
from backend.schemas.progress import ProgressSyncPayload
from backend.services.progress_service import (
    apply_progress_sync,
    compute_student_stats,
    get_lesson_progress,
    get_student_progress,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["progress"])


def _resolve_student_id(current_user: dict, requested: str, db: Session) -> str:
    """Resolve the student_id a caller is allowed to act on.

    Students may only act on their own record; admins/teachers may act on any.
    """
    role = current_user.get("role", "")
    if role in ("admin", "teacher"):
        return requested
    student = db.query(Student).filter(Student.user_id == current_user["sub"]).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student.id


# --- Activity recording (merged from activity.py) ---


class ActivityPayload(BaseModel):
    student_id: str
    lesson_id: str
    lesson_title: str = ""


@router.post("/activity")
@router.post("/activity/")
def record_activity(body: ActivityPayload, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Record that a student viewed a lesson (server-side, replaces localStorage)."""
    student_id = _resolve_student_id(current_user, body.student_id, db)
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


def _do_sync(student_id: str, payload: dict):
    try:
        apply_progress_sync(student_id=student_id, payload=payload)
    except ValueError as exc:
        logger.warning("Progress sync rejected for student %s: %s", student_id, exc)
    except Exception:
        logger.exception("Progress sync failed for student %s", student_id)


@router.post("/sync", response_model=dict)
@router.post("/sync/", response_model=dict)
def sync_progress(body: ProgressSyncPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user=Depends(bridge_auth)):
    role = current_user.get("role", "")
    student_id = body.student_id
    if role != "bridge":
        # JWT-authenticated users may only sync their own progress.
        student_id = _resolve_student_id(current_user, student_id, db)
    background_tasks.add_task(_do_sync, student_id=student_id, payload=body.model_dump())
    return {"status": "queued", "student_id": student_id, "lesson_id": body.lesson_id}


@router.get("/{student_id}/stats")
@router.get("/{student_id}/stats/")
def get_student_stats(student_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return server-side streak, lessons viewed count, average score, and recent lessons."""
    role = current_user.get("role", "")
    if role not in ("admin", "teacher"):
        owned = _resolve_student_id(current_user, "", db)  # throws if caller has no student profile
        if owned != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
    return compute_student_stats(db, student_id)


@router.get("/{student_id}/{lesson_id}", response_model=dict)
@router.get("/{student_id}/{lesson_id}/", response_model=dict)
def get_lesson_progress_route(
    student_id: str,
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return saved blackboard state for a single lesson."""
    role = current_user.get("role", "")
    if role not in ("admin", "teacher"):
        owned = _resolve_student_id(current_user, "", db)
        if owned != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
    data = get_lesson_progress(student_id, lesson_id)
    if not data:
        raise HTTPException(status_code=404, detail="No saved progress for this lesson")
    return data


@router.get("/{student_id}", response_model=dict)
@router.get("/{student_id}/", response_model=dict)
def get_student_progress_route(
    student_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = current_user.get("role", "")
    if role not in ("admin", "teacher"):
        owned = _resolve_student_id(current_user, "", db)
        if owned != student_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this student's data")
    return get_student_progress(student_id, offset=offset, limit=limit)
