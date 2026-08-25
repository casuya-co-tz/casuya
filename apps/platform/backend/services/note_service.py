from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.note import Note


def get_note(user_id: str, lesson_id: str) -> dict | None:
    gen = get_db()
    db: Session = next(gen)
    try:
        note = db.query(Note).filter(Note.user_id == user_id, Note.lesson_id == lesson_id).first()
        if not note:
            return None
        return {
            "id": note.id,
            "user_id": note.user_id,
            "lesson_id": note.lesson_id,
            "content": note.content,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
            "created_at": note.created_at.isoformat() if note.created_at else None,
        }
    finally:
        gen.close()


def save_note(user_id: str, lesson_id: str, content: str) -> dict:
    gen = get_db()
    db: Session = next(gen)
    try:
        note = db.query(Note).filter(Note.user_id == user_id, Note.lesson_id == lesson_id).first()
        now = datetime.now(timezone.utc)
        if note:
            note.content = content
            note.updated_at = now
        else:
            note = Note(user_id=user_id, lesson_id=lesson_id, content=content, updated_at=now, created_at=now)
            db.add(note)
        db.commit()
        return {
            "id": note.id,
            "lesson_id": lesson_id,
            "content": content,
            "updated_at": now.isoformat(),
        }
    finally:
        gen.close()
