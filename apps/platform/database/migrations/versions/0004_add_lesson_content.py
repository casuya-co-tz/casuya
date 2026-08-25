"""Add content column to lessons and lesson_versions tables.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-23 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("content", sa.Text(), nullable=True))
    op.add_column("lesson_versions", sa.Column("content", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lesson_versions", "content")
    op.drop_column("lessons", "content")
