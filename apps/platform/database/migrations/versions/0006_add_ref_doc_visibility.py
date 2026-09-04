"""Add visible_to_students to reference_docs.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-04 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reference_docs",
        sa.Column("visible_to_students", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("reference_docs", "visible_to_students")
