"""Server-side tutor conversation threads."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from backend.models.tutor_thread import TutorThread

MAX_MESSAGES = 8


def get_thread(db: Session, user_id: str, lesson_id: str) -> list[dict]:
    row = (
        db.query(TutorThread)
        .filter(TutorThread.user_id == user_id, TutorThread.lesson_id == lesson_id)
        .first()
    )
    if not row:
        return []
    try:
        data = json.loads(row.messages_json or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_thread(db: Session, user_id: str, lesson_id: str, messages: list[dict]) -> list[dict]:
    trimmed = messages[-MAX_MESSAGES:]
    payload = json.dumps(trimmed)
    row = (
        db.query(TutorThread)
        .filter(TutorThread.user_id == user_id, TutorThread.lesson_id == lesson_id)
        .first()
    )
    if row:
        row.messages_json = payload
    else:
        row = TutorThread(user_id=user_id, lesson_id=lesson_id, messages_json=payload)
        db.add(row)
    db.commit()
    return trimmed
