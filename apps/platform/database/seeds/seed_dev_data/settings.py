"""Lazy app-settings accessor shared by the dev-data seeder."""

from __future__ import annotations

settings_from_config = None


def _settings():
    global settings_from_config
    if settings_from_config is None:
        from backend.config.settings import get_settings

        settings_from_config = get_settings()
    return settings_from_config