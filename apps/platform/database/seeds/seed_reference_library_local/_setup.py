"""Shared setup for the bundled reference-library seeder: logger + constants."""

from __future__ import annotations

import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_reference_library_local")

_BUNDLED_DIR = Path(__file__).resolve().parent.parent / "data" / "reference"

# ``source_id`` prefix so bundled docs never collide with API-imported rows
# (which use plain numeric ids) and can be dropped wholesale if ever needed.
_SOURCE_PREFIX = "bundled:"