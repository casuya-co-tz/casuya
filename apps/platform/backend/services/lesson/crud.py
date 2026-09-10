"""Lesson service — CRUD operations (create, publish, delete, get, update, list)."""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson
from backend.models.lesson_version import LessonVersion

from .content import _cache_invalidate_content


def create_lesson_from_html(
    subtopic_id: str, title: str, html: str, created_by: str | None = None, status: str = "draft"
) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        slug = title.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:8]
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        lesson = Lesson(
            subtopic_id=subtopic_id,
            slug=slug,
            title=title,
            content_hash=content_hash,
            content=html,
            created_by=created_by,
            status=status,
        )
        db.add(lesson)
        db.flush()
        version = LessonVersion(
            lesson_id=lesson.id,
            package_version="1.0.0",
            content_hash=content_hash,
            content=html,
            package_path=f"db://{slug}",
        )
        db.add(version)
        db.commit()
        return {
            "id": lesson.id,
            "slug": slug,
            "title": title,
            "content_hash": content_hash,
            "package_version": "1.0.0",
            "status": status,
        }
    finally:
        _gen.close()


def publish_lesson(lesson_id: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")
        lesson.status = "published"
        db.commit()
        return {"id": lesson.id, "slug": lesson.slug, "status": "published"}
    finally:
        _gen.close()


def delete_lesson(lesson_id: str) -> dict:
    from backend.models.analytics import LessonAnalyticsSnapshot
    from backend.models.bookmark import Bookmark
    from backend.models.game import Game
    from backend.models.note import Note
    from backend.models.progress import ProgressRecord
    from backend.models.quiz import Quiz, QuizOption, QuizQuestion

    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")

        # Bulk-delete child rows in 3 grouped operations instead of 9 separate ones.
        # 1) Collect quiz IDs for this lesson.
        quiz_ids = [q.id for q in db.query(Quiz.id).filter(Quiz.lesson_id == lesson_id).all()]
        if quiz_ids:
            # 2) Collect question IDs for those quizzes, then bulk-delete options + questions.
            q_ids = [q.id for q in db.query(QuizQuestion.id).filter(QuizQuestion.quiz_id.in_(quiz_ids)).all()]
            if q_ids:
                db.query(QuizOption).filter(QuizOption.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.query(QuizQuestion).filter(QuizQuestion.quiz_id.in_(quiz_ids)).delete(synchronize_session=False)
            db.query(Quiz).filter(Quiz.id.in_(quiz_ids)).delete(synchronize_session=False)

        # 3) Bulk-delete remaining child tables in two batches.
        db.query(LessonVersion).filter(LessonVersion.lesson_id == lesson_id).delete(synchronize_session=False)
        db.query(ProgressRecord).filter(ProgressRecord.lesson_id == lesson_id).delete(synchronize_session=False)
        db.query(LessonAnalyticsSnapshot).filter(LessonAnalyticsSnapshot.lesson_id == lesson_id).delete(synchronize_session=False)
        db.query(Bookmark).filter(Bookmark.lesson_id == lesson_id).delete(synchronize_session=False)
        db.query(Note).filter(Note.lesson_id == lesson_id).delete(synchronize_session=False)
        db.query(Game).filter(Game.lesson_id == lesson_id).delete(synchronize_session=False)
        db.delete(lesson)
        db.commit()
        return {"detail": "Lesson deleted"}
    finally:
        _gen.close()


def get_lesson(lesson_id: str) -> dict | None:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            return None
        return {
            "id": lesson.id,
            "subtopic_id": lesson.subtopic_id,
            "slug": lesson.slug,
            "title": lesson.title,
            "content_hash": lesson.content_hash,
            "package_version": lesson.package_version,
            "status": lesson.status,
            "created_by": lesson.created_by,
        }
    finally:
        _gen.close()


def update_lesson(lesson_id: str, title: str | None = None, html: str | None = None) -> dict:
    from backend.models.lesson_version import LessonVersion

    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")
        if title is not None:
            lesson.title = title
        if html is not None:
            content_hash = hashlib.sha256(html.encode()).hexdigest()
            lesson.content_hash = content_hash
            lesson.content = html
            version = LessonVersion(
                lesson_id=lesson.id,
                package_version="1.0.0",
                content_hash=content_hash,
                content=html,
                package_path=f"db://{lesson.slug}",
            )
            db.add(version)
            _cache_invalidate_content(lesson.slug)
        db.commit()
        return {"id": lesson.id, "slug": lesson.slug, "title": lesson.title, "status": lesson.status}
    finally:
        _gen.close()


def list_lessons(
    subtopic_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    created_by: str | None = None,
) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(Lesson)
        if subtopic_id:
            query = query.filter(Lesson.subtopic_id == subtopic_id)
        if status:
            query = query.filter(Lesson.status == status)
        if created_by:
            query = query.filter(Lesson.created_by == created_by)
        lessons = query.offset(skip).limit(limit).all()
        return [
            {
                "id": l.id,
                "subtopic_id": l.subtopic_id,
                "slug": l.slug,
                "title": l.title,
                "status": l.status,
                "created_by": l.created_by,
            }
            for l in lessons
        ]
    finally:
        _gen.close()
