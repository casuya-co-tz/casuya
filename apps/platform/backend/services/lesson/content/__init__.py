"""Lesson service — content rendering, caching and package-path sharding.

Includes the Redis-backed content cache, LaTeX detection & KaTeX injection,
and media optimization for low-bandwidth (2G/3G) delivery.
"""

from __future__ import annotations

from .cache import (  # noqa: F401
    _cache_get,
    _cache_invalidate_content,
    _cache_set,
)
from .paths import get_package_path
from .reader import read_lesson_content
from .media import optimize_media

__all__ = [
    "get_package_path",
    "optimize_media",
    "read_lesson_content",
]