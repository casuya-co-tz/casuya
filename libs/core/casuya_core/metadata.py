import re
from pathlib import Path
from typing import Dict, Any, Optional
from .parsers import HTMLParser


def create_metadata(html_path: Path) -> Dict[str, Any]:
    html_parser = HTMLParser()
    try:
        html = html_path.read_text("utf-8")
    except Exception:
        html = ""

    parsed = html_parser.parse(html) if html else {}
    meta = parsed.get("meta", {})

    return {
        "title": parsed.get("title") or html_path.stem.replace("_", " ").title(),
        "subject": meta.get("subject", "General Education"),
        "topic": meta.get("topic") or html_path.stem.replace("_", " ").title(),
        "description": meta.get("description", ""),
        "author": meta.get("author", ""),
        "difficulty": meta.get("difficulty", "Medium"),
        "language": meta.get("language", "en"),
        "duration_minutes": _parse_duration(meta.get("duration", "30")),
        "grade_level": meta.get("grade_level", ""),
        "tags": _parse_tags(meta.get("keywords", "interactive, lesson")),
        "prerequisites": meta.get("prerequisites", ""),
        "learning_objectives": meta.get("learning_objectives", ""),
    }


def _parse_duration(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return 30


def _parse_tags(value: str) -> list:
    return [t.strip() for t in value.split(",") if t.strip()]
