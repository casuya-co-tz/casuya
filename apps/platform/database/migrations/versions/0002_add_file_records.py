"""Add file_records table for upload visibility and metadata.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "file_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("filename"),
    )
    op.create_index("ix_file_records_filename", "file_records", ["filename"])


def downgrade() -> None:
    op.drop_index("ix_file_records_filename", table_name="file_records")
    op.drop_table("file_records")
