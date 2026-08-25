"""Activity recording endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.models.activity import RecentActivity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["progress"])


class ActivityPayload(BaseModel):
    student_id: str
    lesson_id: str
    lesson_title: str = ""


@router.post("/activity")
@router.post("/activity/")
def record_activity(body: ActivityPayload, _current_user=Depends(get_current_user)):
    """Record that a student viewed a lesson (server-side, replaces localStorage)."""
    db: Session = next(get_db())
    try:
        record = RecentActivity(
            student_id=body.student_id,
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
