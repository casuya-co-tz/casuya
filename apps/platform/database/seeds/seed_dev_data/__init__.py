"""Seed a small set of development users, subjects, topics, subtopics and one
sample lesson + game + quiz (identical to ``seed_necta_syllabus`` in spirit but
kept deliberately small for quick local demos).

Usage (from the repo -- database module is importable as ``database.seeds``):

    python -m database.seeds.seed_dev_data
"""

from __future__ import annotations

from .data import subjects_data, form_levels, topics_data, subtopics_data
from .settings import settings_from_config, _settings
from .run import run

__all__ = [
    "subjects_data",
    "form_levels",
    "topics_data",
    "subtopics_data",
    "settings_from_config",
    "_settings",
    "run",
]


if __name__ == "__main__":
    run()