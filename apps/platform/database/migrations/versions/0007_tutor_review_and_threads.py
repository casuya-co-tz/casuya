"""Add tutor review queue and server-side tutor threads.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tutor_review_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("lesson_id", sa.String(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("subject_slug", sa.String(), nullable=True),
        sa.Column("format_level", sa.String(), server_default="none"),
        sa.Column("flagged_terms", sa.Text(), nullable=True),
        sa.Column("source", sa.String(), server_default="casuya-ai"),
        sa.Column("status", sa.String(), server_default="pending"),
        sa.Column("reviewer_id", sa.String(), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_tutor_review_status", "tutor_review_items", ["status"])
    op.create_index("ix_tutor_review_created", "tutor_review_items", ["created_at"])

    op.create_table(
        "tutor_threads",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("lesson_id", sa.String(), nullable=False),
        sa.Column("messages_json", sa.Text(), server_default="[]"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_tutor_thread_user_lesson"),
    )
    op.create_index("ix_tutor_thread_user", "tutor_threads", ["user_id"])
    op.create_index("ix_tutor_thread_lesson", "tutor_threads", ["lesson_id"])


def downgrade() -> None:
    op.drop_table("tutor_threads")
    op.drop_table("tutor_review_items")
