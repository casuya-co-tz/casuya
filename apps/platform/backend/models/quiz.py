"""Quiz questions and answer options tied to a lesson."""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str | None] = mapped_column(String, nullable=True)
    package_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    quiz_id: Mapped[str] = mapped_column(ForeignKey("quizzes.id"), nullable=False)
    prompt: Mapped[str] = mapped_column(String, nullable=False)


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    question_id: Mapped[str] = mapped_column(ForeignKey("quiz_questions.id"), nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
