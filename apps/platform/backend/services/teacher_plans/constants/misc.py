"""Small shared constants for teacher plan generation."""

from __future__ import annotations

# How many repair rounds the AI gets before the near-zero deterministic recovery.
MAX_PLAN_REPAIR_ATTEMPTS = 2


_GENERIC_ASSESSMENT_PHRASES = (
    "students will learn", "students will understand", "understand the concept",
    "understand the topic", "good understanding", "basic understanding",
    "demonstrate understanding of the concept", "wanafunzi watajifunza",
    "wanafunzi wataelewa", "kuelewa dhana", "kuelewa mada",
)


_ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
          "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii"]