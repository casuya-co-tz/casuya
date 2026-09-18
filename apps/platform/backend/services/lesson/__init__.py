"""Lesson service — CRUD, content rendering, quiz/progress management."""

from .content import (  # noqa: F401
    get_gzip_path,
    get_package_path,
    optimize_media,
    read_lesson_content,
    write_content_gzip,
)
from .crud import (  # noqa: F401
    count_lessons,
    create_lesson_from_html,
    delete_lesson,
    get_lesson,
    get_lesson_by_slug,
    list_lessons,
    publish_lesson,
    update_lesson,
)
from .essential import strip_essential_html  # noqa: F401
from .manifests import list_lesson_manifests  # noqa: F401
from .quiz import get_lesson_package  # noqa: F401

__all__ = [
    "get_gzip_path",
    "get_package_path",
    "optimize_media",
    "read_lesson_content",
    "write_content_gzip",
    "count_lessons",
    "create_lesson_from_html",
    "delete_lesson",
    "get_lesson",
    "get_lesson_by_slug",
    "list_lessons",
    "publish_lesson",
    "update_lesson",
    "strip_essential_html",
    "list_lesson_manifests",
    "get_lesson_package",
]
