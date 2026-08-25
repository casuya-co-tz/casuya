from datetime import datetime, timezone

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.settings import get_settings
from backend.models.notification import Notification

_settings = get_settings()


def _send_sms(phone: str, message: str) -> bool:
    if not _settings.africastalking_username or not _settings.africastalking_api_key:
        return False
    try:
        resp = httpx.post(
            "https://api.africastalking.com/version1/messaging",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "apiKey": _settings.africastalking_api_key,
            },
            data={
                "username": _settings.africastalking_username,
                "to": phone,
                "message": message,
            },
            timeout=5.0,
        )
        return resp.status_code == 201 or resp.status_code == 200
    except Exception:
        return False


def send_notification(
    db: Session, user_id: str, message: str, channel: str = "in_app", phone: str | None = None
) -> dict:
    notification = Notification(
        user_id=user_id,
        channel=channel,
        message=message,
        is_read=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    db.commit()

    if channel == "sms" and phone:
        _send_sms(phone, message)

    return {"id": notification.id, "user_id": user_id, "channel": channel, "message": message}


def list_notifications(
    db: Session,
    user_id: str,
    offset: int = 0,
    limit: int = 50,
    max_limit: int = 100,
) -> dict:
    limit = min(limit, max_limit)
    total = db.query(func.count(Notification.id)).filter(Notification.user_id == user_id).scalar()
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {"id": n.id, "user_id": n.user_id, "channel": n.channel, "message": n.message, "is_read": n.is_read}
            for n in notifications
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + limit < total,
    }


def mark_notification_read(db: Session, notification_id: str) -> dict:
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise ValueError("Notification not found")
    notification.is_read = True
    db.commit()
    return {"id": notification.id, "is_read": True}
