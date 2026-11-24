from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.user import User
from backend.services.notification_service import list_notifications, mark_notification_read, send_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class SendNotificationRequest(BaseModel):
    user_id: str | None = None
    role: str | None = None
    message: str


@router.get("")
@router.get("/")
def list_notifications_route(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return list_notifications(db, user_id=current_user["sub"], offset=offset, limit=limit)


@router.post("", dependencies=[Depends(require_role("admin"))])
@router.post("/", dependencies=[Depends(require_role("admin"))])
def send_notification_route(body: SendNotificationRequest, db: Session = Depends(get_db)):
    if not body.user_id and not body.role:
        raise HTTPException(status_code=400, detail="Provide user_id or role")
    if body.user_id:
        result = send_notification(db, user_id=body.user_id, message=body.message)
        return {"sent": 1, "notifications": [result]}
    return _broadcast_by_role(db, body.role, body.message)


@router.post("/bulk", dependencies=[Depends(require_role("admin"))])
@router.post("/bulk/", dependencies=[Depends(require_role("admin"))])
def send_bulk_notification_route(body: SendNotificationRequest, db: Session = Depends(get_db)):
    if not body.role:
        raise HTTPException(status_code=400, detail="Provide role (student|teacher)")
    return _broadcast_by_role(db, body.role, body.message)


def _broadcast_by_role(db: Session, role: str, message: str) -> dict:
    """Create in-app notifications in bounded batches.

    The old implementation loaded every active user id into a list and built
    one Notification object per user before a single commit. Keyset pagination
    keeps memory flat and commits in batches, so a large broadcast cannot pin
    the whole user table in RAM. Keyset (rather than ``yield_per``) is used
    because committing mid-iteration would invalidate a streaming cursor.
    """
    from datetime import datetime, timezone

    from backend.models.notification import Notification

    batch_size = 500
    sent = 0
    last_id: str | None = None
    while True:
        query = db.query(User.id).filter(User.role == role, User.is_active.is_(True))
        if last_id is not None:
            query = query.filter(User.id > last_id)
        rows = query.order_by(User.id).limit(batch_size).all()
        if not rows:
            break
        now = datetime.now(timezone.utc)
        db.add_all([
            Notification(
                user_id=row.id,
                channel="in_app",
                message=message,
                is_read=False,
                created_at=now,
            )
            for row in rows
        ])
        db.commit()
        sent += len(rows)
        last_id = rows[-1].id
    if sent == 0:
        raise HTTPException(status_code=404, detail=f"No active {role}s found")
    return {"sent": sent}


@router.post("/{notification_id}/read")
@router.post("/{notification_id}/read/")
def mark_read_route(notification_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = current_user.get("role", "")
    user_id = None if role == "admin" else current_user["sub"]
    try:
        return mark_notification_read(db, notification_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
