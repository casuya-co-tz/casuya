"""Game create/update/delete lifecycle operations."""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.orm import Session

from backend.models.game import Game

from .paths import _get_game_pkg_path
from .render import _build_structured_game_html


def create_structured_game(
    db: Session,
    lesson_id: str | None,
    title: str,
    questions: list[dict],
    options: list[dict] | None = None,
) -> dict:
    html = _build_structured_game_html(title, questions)
    return create_game_from_html(db, lesson_id=lesson_id, title=title, html=html)


def create_game_from_html(
    db: Session,
    lesson_id: str | None,
    title: str,
    html: str,
) -> dict:
    slug = title.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:8]
    content_hash = hashlib.sha256(html.encode()).hexdigest()
    pkg_path = _get_game_pkg_path(slug)
    resolved_lesson_id = lesson_id or None
    game = Game(
        lesson_id=resolved_lesson_id,
        title=title,
        slug=slug,
        package_path=str(pkg_path),
        package_html=html,
        content_hash=content_hash,
    )
    db.add(game)
    db.flush()
    pkg_path.parent.mkdir(parents=True, exist_ok=True)
    pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": game.id, "slug": slug, "title": title, "content_hash": content_hash, "status": "draft"}


def publish_game(db: Session, game_id: str) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    game.status = "published"
    db.commit()
    return {"id": game.id, "slug": game.slug, "status": "published"}


def delete_game(db: Session, game_id: str) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    slug = game.slug
    db.delete(game)
    db.commit()
    if slug:
        pkg_path = _get_game_pkg_path(slug)
        if pkg_path.exists():
            pkg_path.unlink()
    return {"detail": "Game deleted"}


def update_game(
    db: Session,
    game_id: str,
    title: str | None = None,
    html: str | None = None,
) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    if title is not None:
        game.title = title
    if html is not None:
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        game.content_hash = content_hash
        game.package_html = html
        pkg_path = _get_game_pkg_path(game.slug)
        game.package_path = str(pkg_path)
        pkg_path.parent.mkdir(parents=True, exist_ok=True)
        pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": game.id, "slug": game.slug, "title": game.title, "status": game.status}