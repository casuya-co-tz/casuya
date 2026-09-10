"""Content-payload shaping and title helpers for bundled reference docs."""

from __future__ import annotations

import re


def _content_for(lesson: dict) -> dict:
    """Wrap one plan detail into the reference content payload shape."""
    return {
        "title": lesson.get("title") or "",
        "standard": lesson.pop("standard", "") or "",
        "plan_details": [lesson],
    }


def _scheme_content_for(scheme: dict) -> dict:
    """Wrap one scheme-of-work bundle into the reference content payload shape."""
    return {
        "title": scheme.get("title") or "",
        "standard": scheme.get("standard") or "",
        "term": scheme.get("term"),
        "scheme_of_work_details": list(scheme.get("scheme_of_work_details") or []),
    }


def _stable_id(title: str) -> str:
    """Derive a stable per-lesson id from its title (e.g. a lesson number)."""
    cleaned = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")
    return cleaned or "lesson"


def _normalize_title(title: str) -> str:
    """Collapse a title to a canonical form for deduplication.

    Strips punctuation, normalises whitespace and removes common cosmetic
    differences (e.g. ``FORM ONE 2026`` vs ``FORM ONE-2026``) so two titles
    that refer to the same lesson/scheme are considered equal.
    """
    t = (title or "").lower()
    # Remove punctuation except alphanumerics and spaces
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    # Collapse whitespace
    t = " ".join(t.split())
    return t.strip()