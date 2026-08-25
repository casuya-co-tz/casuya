import hashlib
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from backend.config.settings import get_settings
from backend.models.game import Game

settings = get_settings()


def _get_game_pkg_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "game-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"


def get_games_for_lesson(db: Session, lesson_id: str) -> list[dict]:
    games = db.query(Game).filter(Game.lesson_id == lesson_id).all()
    return [
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


def list_games(db: Session) -> list[dict]:
    games = db.query(Game).all()
    return [
        {
            "id": g.id,
            "lesson_id": g.lesson_id,
            "title": g.title,
            "slug": g.slug,
            "status": g.status,
            "content_hash": g.content_hash,
        }
        for g in games
    ]


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


def read_game_content(db: Session, slug: str) -> str | None:
    game = db.query(Game).filter(Game.slug == slug).first()
    if game and game.package_html:
        return game.package_html
    pkg_path = _get_game_pkg_path(slug)
    if pkg_path.exists():
        return pkg_path.read_text(encoding="utf-8")
    return None


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
