"""Drop AI tutor tables (tutor review queue and server-side threads).

AI tutoring was removed from the platform, so the review queue and the
server-side tutor conversation threads are no longer used.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tutor_threads")
    op.execute("DROP TABLE IF EXISTS tutor_review_items")


def downgrade() -> None:
    # The AI tutor feature is retired; recreating the tables is not supported.
    pass
