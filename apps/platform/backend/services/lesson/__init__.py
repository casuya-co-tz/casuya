"""Lesson service — CRUD, content rendering, quiz/progress management."""

from .content import (  # noqa: F401
    get_package_path,
    optimize_media,
    read_lesson_content,
)
from .crud import (  # noqa: F401
    create_lesson_from_html,
    delete_lesson,
    get_lesson,
    list_lessons,
    publish_lesson,
    update_lesson,
)
from .quiz import get_lesson_package  # noqa: F401

__all__ = [
    # Public API
    "get_package_path",
    "optimize_media",
    "read_lesson_content",
    "create_lesson_from_html",
    "delete_lesson",
    "get_lesson",
    "list_lessons",
    "publish_lesson",
    "update_lesson",
    "get_lesson_package",
]
