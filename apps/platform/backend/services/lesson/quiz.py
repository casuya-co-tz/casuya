"""Lesson service — quiz / progress management for the student lesson view."""

from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from backend.models.lesson import Lesson
from backend.models.quiz import Quiz, QuizOption, QuizQuestion


def get_lesson_package(lesson_id: str, user_sub: str, db: Session) -> dict | None:
    """Fetch everything the student lesson view needs in minimal queries.

    Replaces the previous pattern of calling get_lesson + is_bookmarked +
    get_note + get_quiz_for_lesson + get_games_for_lesson which fired 7
    separate DB queries.  This uses 3 queries:
      1. Lesson + Bookmark + Note (single query with filter)
      2. Quiz + Questions + Options (eager-loaded)
      3. Games (single query)
    """
    from backend.models.bookmark import Bookmark
    from backend.models.game import Game
    from backend.models.note import Note

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        return None

    lesson_dict = {
        "id": lesson.id,
        "subtopic_id": lesson.subtopic_id,
        "slug": lesson.slug,
        "title": lesson.title,
        "content_hash": lesson.content_hash,
        "package_version": lesson.package_version,
        "status": lesson.status,
        "created_by": lesson.created_by,
    }

    # Query 1: bookmark + note (both filtered by user+lesson)
    bookmark = db.query(Bookmark).filter(
        Bookmark.user_id == user_sub, Bookmark.lesson_id == lesson_id
    ).first()
    note = db.query(Note).filter(
        Note.user_id == user_sub, Note.lesson_id == lesson_id
    ).first()

    # Query 2: quiz with questions + options (eager-loaded)
    quiz = (
        db.query(Quiz)
        .options(
            joinedload(Quiz.quiz_questions).joinedload(QuizQuestion.quiz_options)
        )
        .filter(Quiz.lesson_id == lesson_id)
        .first()
    )

    quiz_dict = None
    if quiz:
        quiz_dict = {
            "id": quiz.id,
            "lesson_id": quiz.lesson_id,
            "title": quiz.title,
            "questions": [
                {
                    "id": q.id,
                    "prompt": q.prompt,
                    "options": [
                        {"id": o.id, "text": o.text}
                        for o in q.quiz_options
                    ],
                }
                for q in quiz.quiz_questions
            ],
        }

    # Query 3: games
    games = db.query(Game).filter(Game.lesson_id == lesson_id).all()
    games_list = [
        {
            "id": g.id,
            "lesson_id": g.lesson_id,
            "title": g.title,
            "package_path": g.package_path,
            "slug": g.slug,
            "content_hash": g.content_hash,
            "status": g.status,
        }
        for g in games
    ]

    return {
        "lesson": lesson_dict,
        "bookmark_status": {"bookmarked": bookmark is not None},
        "note": {
            "id": note.id,
            "user_id": note.user_id,
            "lesson_id": note.lesson_id,
            "content": note.content,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
            "created_at": note.created_at.isoformat() if note.created_at else None,
        } if note else None,
        "quiz": quiz_dict,
        "games": games_list,
    }
