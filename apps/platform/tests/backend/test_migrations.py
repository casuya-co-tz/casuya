"""Tests for the Alembic migration chain that removes the retired AI tutor."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import patch

MIGRATIONS = (
    Path(__file__).resolve().parents[2] / "database" / "migrations" / "versions"
)


def _load(revision_file: str):
    path = MIGRATIONS / revision_file
    spec = importlib.util.spec_from_file_location(f"migration_{revision_file[:-3]}", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_0008_drops_both_ai_tutor_tables():
    module = _load("0008_drop_ai_tutor_tables.py")
    assert module.revision == "0008"
    assert module.down_revision == "0007"

    with patch.object(module.op, "execute") as execute:
        module.upgrade()

    statements = [call.args[0] for call in execute.call_args_list]
    assert any("DROP TABLE IF EXISTS tutor_threads" in s for s in statements)
    assert any("DROP TABLE IF EXISTS tutor_review_items" in s for s in statements)


def test_0008_downgrade_is_explicitly_irreversible():
    module = _load("0008_drop_ai_tutor_tables.py")
    with patch.object(module.op, "execute") as execute:
        module.downgrade()
    execute.assert_not_called()
