"""Game package HTML delivery."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.game import Game
from backend.services.html_assets import rewrite_external_assets

from .paths import _get_game_pkg_path


def read_game_content(db: Session, slug: str) -> str | None:
    game = db.query(Game).filter(Game.slug == slug).first()
    if game and game.package_html:
        return rewrite_external_assets(game.package_html)
    pkg_path = _get_game_pkg_path(slug)
    if pkg_path.exists():
        return rewrite_external_assets(pkg_path.read_text(encoding="utf-8"))
    return None