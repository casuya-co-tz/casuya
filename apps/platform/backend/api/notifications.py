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
    users = db.query(User).filter(User.role == body.role, User.is_active.is_(True)).all()
    if not users:
        raise HTTPException(status_code=404, detail=f"No active {body.role}s found")
    # Batch insert: create all notifications in one commit (P-02)
    results = []
    for u in users:
        results.append({"user_id": u.id, "message": body.message})
    from backend.models.notification import Notification
    from datetime import datetime, timezone

    notifications = [
        Notification(
            user_id=r["user_id"],
            channel="in_app",
            message=r["message"],
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        for r in results
    ]
    db.add_all(notifications)
    db.commit()
    return {"sent": len(notifications), "notifications": [{"id": n.id, "user_id": n.user_id, "message": n.message} for n in notifications]}


@router.post("/bulk", dependencies=[Depends(require_role("admin"))])
@router.post("/bulk/", dependencies=[Depends(require_role("admin"))])
def send_bulk_notification_route(body: SendNotificationRequest, db: Session = Depends(get_db)):
    if not body.role:
        raise HTTPException(status_code=400, detail="Provide role (student|teacher)")
    users = db.query(User).filter(User.role == body.role, User.is_active.is_(True)).all()
    if not users:
        raise HTTPException(status_code=404, detail=f"No active {body.role}s found")
    # Batch insert: single commit for all notifications (P-02)
    from backend.models.notification import Notification
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    notifications = [
        Notification(
            user_id=u.id,
            channel="in_app",
            message=body.message,
            is_read=False,
            created_at=now,
        )
        for u in users
    ]
    db.add_all(notifications)
    db.commit()
    return {"sent": len(notifications)}


@router.post("/{notification_id}/read")
@router.post("/{notification_id}/read/")
def mark_read_route(notification_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = current_user.get("role", "")
    user_id = None if role == "admin" else current_user["sub"]
    try:
        return mark_notification_read(db, notification_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
