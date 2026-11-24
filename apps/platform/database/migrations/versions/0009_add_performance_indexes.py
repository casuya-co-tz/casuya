"""Add composite performance indexes for 2000-student scale.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_INDEXES = [
    ("ix_progress_student_synced", "progress_records", ["student_id", "synced_at"]),
    ("ix_notifications_user_read_created", "notifications", ["user_id", "is_read", "created_at"]),
]


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        col_sql = ", ".join(cols)
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({col_sql})")


def downgrade() -> None:
    for name, _table, _cols in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")