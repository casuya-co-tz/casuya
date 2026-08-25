"""Lesson catalog: subjects -> topics -> subtopics -> lessons."""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (Index("ix_topic_subject_id", "subject_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    form_level: Mapped[str] = mapped_column(String, nullable=False)


class Subtopic(Base):
    __tablename__ = "subtopics"
    __table_args__ = (Index("ix_subtopic_topic_id", "topic_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        Index("ix_lesson_subtopic_id", "subtopic_id"),
        Index("ix_lesson_status", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    subtopic_id: Mapped[str] = mapped_column(ForeignKey("subtopics.id"), nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    package_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    package_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    package_version: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")
