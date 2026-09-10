"""Exam paper generation — deterministic offline (local) question generation.

Builds questions grounded in lesson text for the offline-first / 2G fallback
path when the casuya-ai service is unreachable.
"""

from __future__ import annotations

from .generate import generate_section_questions_local

__all__ = ["generate_section_questions_local"]