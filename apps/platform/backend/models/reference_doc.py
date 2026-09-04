"""Curated reference library of official TIE/PO-RALG lessons and schemes.

Imports the full public catalog from the reference platform
(clickonlineacademy.ac.tz) so teachers can browse/search official example
lesson plans and schemes of work for any subject/form, and use the matching
rows as grounding context when generating new documents.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class ReferenceDoc(Base):
    """One imported reference document (a lesson plan or scheme of work).

    ``doc_type`` is ``lesson_plan`` or ``scheme_of_work``. The full source
    payload is stored verbatim in ``content`` as JSON, while the searchable
    columns (title, subject_slug, form_level, standard, source_id) let the
    browse/search API filter efficiently. ``subject_slug``/``form_level`` are
    best-effort mappings to Casuya subjects and may be null when a document
    has no obvious native mapping (e.g. Primary-standard-only subjects).
    """

    __tablename__ = "reference_docs"
    __table_args__ = (
        Index("ix_reference_doc_type_form", "doc_type", "form_level"),
        Index("ix_reference_doc_subject", "subject_slug"),
        Index("ix_reference_doc_source", "doc_type", "source_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    doc_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subject_name: Mapped[str | None] = mapped_column(String, nullable=True)
    subject_slug: Mapped[str | None] = mapped_column(String, nullable=True)
    form_level: Mapped[int | None] = mapped_column(nullable=True)
    standard: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    visible_to_students: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
