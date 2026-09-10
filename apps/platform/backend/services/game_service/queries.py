"""Read-only game queries."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.game import Game


def get_games_for_lesson(db: Session, lesson_id: str) -> list[dict]:
    games = db.query(Game).filter(Game.lesson_id == lesson_id).all()
    return [
        {
            "id": g.id,
            "lesson_id": g.lesson_id,
            "title": g.title,
            "slug": g.slug,
            "content_hash": g.content_hash,
            "status": g.status,
        }
        for g in games
    ]


def list_games(db: Session, offset: int = 0, limit: int = 200) -> dict:
    total = db.query(Game).count()
    games = db.query(Game).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": g.id,
                "lesson_id": g.lesson_id,
                "title": g.title,
                "slug": g.slug,
                "status": g.status,
                "content_hash": g.content_hash,
            }
            for g in games
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


def get_game(db: Session, game_id: str) -> dict | None:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return None
    return {
        "id": game.id,
        "lesson_id": game.lesson_id,
        "title": game.title,
        "slug": game.slug,
        "status": game.status,
        "content_hash": game.content_hash,
    }