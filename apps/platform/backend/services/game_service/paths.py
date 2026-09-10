"""Storage paths for game packages."""

from __future__ import annotations

from pathlib import Path

from backend.config.settings import get_settings

settings = get_settings()


def _get_game_pkg_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "game-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"