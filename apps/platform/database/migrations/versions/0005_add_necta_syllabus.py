"""Add NECTA/TIE syllabus tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # syllabus_subjects
    op.create_table(
        "syllabus_subjects",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("necta_code", sa.String(), nullable=True),
        sa.Column("form_start", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("form_end", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("is_core", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_syllabus_subject_code", "syllabus_subjects", ["code"], unique=True)
    op.create_index("ix_syllabus_subject_slug", "syllabus_subjects", ["slug"], unique=True)

    # syllabus_topics
    op.create_table(
        "syllabus_topics",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), sa.ForeignKey("syllabus_subjects.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("form_level", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_periods", sa.Integer(), nullable=True),
        sa.Column("necta_weight", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_syllabus_topic_subject", "syllabus_topics", ["subject_id"])
    op.create_index("ix_syllabus_topic_form", "syllabus_topics", ["form_level"])

    # syllabus_subtopics
    op.create_table(
        "syllabus_subtopics",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("topic_id", sa.String(), sa.ForeignKey("syllabus_topics.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_periods", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_syllabus_subtopic_topic", "syllabus_subtopics", ["topic_id"])

    # learning_outcomes
    op.create_table(
        "learning_outcomes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("subtopic_id", sa.String(), sa.ForeignKey("syllabus_subtopics.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("cognitive_level", sa.String(), nullable=False, server_default="comprehension"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_learning_outcome_subtopic", "learning_outcomes", ["subtopic_id"])


def downgrade() -> None:
    op.drop_table("learning_outcomes")
    op.drop_table("syllabus_subtopics")
    op.drop_table("syllabus_topics")
    op.drop_table("syllabus_subjects")
