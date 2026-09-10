"""Game service — create, serve and manage playable HTML quiz games."""

from __future__ import annotations

from .content import read_game_content
from .crud import (
    create_game_from_html,
    create_structured_game,
    delete_game,
    publish_game,
    update_game,
)
from .paths import _get_game_pkg_path
from .queries import get_game, get_games_for_lesson, list_games

__all__ = [
    "_get_game_pkg_path",
    "create_game_from_html",
    "create_structured_game",
    "delete_game",
    "get_game",
    "get_games_for_lesson",
    "list_games",
    "publish_game",
    "read_game_content",
    "update_game",
]