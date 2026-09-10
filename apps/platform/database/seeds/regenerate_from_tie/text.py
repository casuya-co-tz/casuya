"""Text normalisation helpers shared by the TIE knowledge-base regenerator."""

from __future__ import annotations

import re

# Common OCR artifacts seen in the parsed TIE PDFs (double letters, stray dots).
_OCR_FIXES = [
    (re.compile(r"(?i)\bifrst\b"), "first"),
    (re.compile(r"(?i)\bscientiifc\b"), "scientific"),
    (re.compile(r"(?i)\bbasicc\b"), "basic"),
    (re.compile(r"(?i)\bexplaain\b"), "explain"),
]


def _clean(text: str | None) -> str:
    """Normalise whitespace and collapse repeated/full-stop noise from OCR."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    for pat, repl in _OCR_FIXES:
        text = pat.sub(repl, text)
    return text


def _dedupe_active_verb(text: str) -> str:
    """Collapse accidental doubled leading verbs (e.g. 'Use Use ...')."""
    parts = text.split()
    if len(parts) >= 2 and parts[0].lower() == parts[1].lower():
        del parts[0]
    return " ".join(parts)