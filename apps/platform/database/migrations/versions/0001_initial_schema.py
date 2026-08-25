"""Initial database schema.

Revision ID: 0001
Revises:
Create Date: 2026-07-04 09:06:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("phone"),
    )
    op.create_table(
        "settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource", sa.String(), nullable=True),
        sa.Column("metadata_json", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "subjects",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "payments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("amount_tzs", sa.Float(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_reference", sa.String(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_table(
        "students",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("form_level", sa.String(), nullable=True),
        sa.Column("school_code", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "teachers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("subjects", sa.String(), nullable=True),
        sa.Column("school_code", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "topics",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("form_level", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "subtopics",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("topic_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "lessons",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("subtopic_id", sa.String(), nullable=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "lesson_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("lesson_id", sa.String(), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("package_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "quizzes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("subject_id", sa.String(), nullable=True),
        sa.Column("form_level", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "games",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("subject_id", sa.String(), nullable=True),
        sa.Column("form_level", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "progress_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("lesson_id", sa.String(), nullable=True),
        sa.Column("completion_percentage", sa.Float(), nullable=False),
        sa.Column("score_percentage", sa.Float(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "lesson_analytics_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("lesson_id", sa.String(), nullable=True),
        sa.Column("total_students", sa.Integer(), nullable=False),
        sa.Column("avg_completion_percentage", sa.Float(), nullable=False),
        sa.Column("avg_score_percentage", sa.Float(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("lesson_analytics_snapshots")
    op.drop_table("notifications")
    op.drop_table("progress_records")
    op.drop_table("games")
    op.drop_table("quizzes")
    op.drop_table("lesson_versions")
    op.drop_table("lessons")
    op.drop_table("subtopics")
    op.drop_table("topics")
    op.drop_table("teachers")
    op.drop_table("students")
    op.drop_table("payments")
    op.drop_table("subjects")
    op.drop_table("audit_logs")
    op.drop_table("settings")
    op.drop_table("users")
    op.drop_table("roles")
