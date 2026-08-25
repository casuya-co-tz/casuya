"""NECTA/TIE syllabus data models for the Tanzania national curriculum.

These models store the official Tanzania Institute of Education (TIE) syllabus
structure for all CSEE (Certificate of Secondary Education Examination) subjects.
The AI agent uses this data to serve curriculum-aligned content to students.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config.database import Base
from backend.models.user import _uuid


class SyllabusSubject(Base):
    """A NECTA exam subject (e.g. Mathematics, Physics, Biology).

    Each subject has a code matching the official NECTA subject code,
    covers a specific form range (I-IV for O-Level, V-VI for A-Level),
    and contains topics that map directly to the TIE syllabus.
    """

    __tablename__ = "syllabus_subjects"
    __table_args__ = (
        Index("ix_syllabus_subject_code", "code", unique=True),
        Index("ix_syllabus_subject_slug", "slug", unique=True),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "Basic Mathematics"
    code: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "MATH"
    slug: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "mathematics"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    necta_code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "021"
    form_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # Starting form level
    form_end: Mapped[int] = mapped_column(Integer, nullable=False, default=4)  # Ending form level
    is_core: Mapped[bool] = mapped_column(Boolean, default=True)  # Core vs optional subject
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    topics: Mapped[list[SyllabusTopic]] = relationship(
        "SyllabusTopic",
        back_populates="subject",
        cascade="all, delete-orphan",
        order_by="SyllabusTopic.order_index",
    )


class SyllabusTopic(Base):
    """A topic within a NECTA syllabus subject.

    Maps directly to TIE syllabus topics. Each topic belongs to a specific
    form level and contains subtopics with learning outcomes.

    Example: "1.0 NUMBERS" in Mathematics Form I, or "5.0 FORCES" in Physics Form II.
    """

    __tablename__ = "syllabus_topics"
    __table_args__ = (
        Index("ix_syllabus_topic_subject", "subject_id"),
        Index("ix_syllabus_topic_form", "form_level"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("syllabus_subjects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "NUMBERS"
    code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "1.0"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    form_level: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4 for O-Level
    order_index: Mapped[int] = mapped_column(Integer, default=0)  # Display ordering
    estimated_periods: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Teaching periods
    necta_weight: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "high", "medium", "low"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    subject: Mapped[SyllabusSubject] = relationship("SyllabusSubject", back_populates="topics")
    subtopics: Mapped[list[SyllabusSubtopic]] = relationship(
        "SyllabusSubtopic",
        back_populates="topic",
        cascade="all, delete-orphan",
        order_by="SyllabusSubtopic.order_index",
    )


class SyllabusSubtopic(Base):
    """A subtopic within a NECTA syllabus topic.

    Contains the specific learning outcomes that the AI agent uses to:
    1. Generate curriculum-aligned tutoring explanations
    2. Create practice questions matching TIE objectives
    3. Track syllabus coverage for teachers
    4. Recommend the next topic to study

    Example: "1.1 Base ten numeration" in Mathematics Form I, Topic 1.
    """

    __tablename__ = "syllabus_subtopics"
    __table_args__ = (Index("ix_syllabus_subtopic_topic", "topic_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    topic_id: Mapped[str] = mapped_column(ForeignKey("syllabus_topics.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "Base ten numeration"
    code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "1.1"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    estimated_periods: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    topic: Mapped[SyllabusTopic] = relationship("SyllabusTopic", back_populates="subtopics")
    outcomes: Mapped[list[LearningOutcome]] = relationship(
        "LearningOutcome",
        back_populates="subtopic",
        cascade="all, delete-orphan",
        order_by="LearningOutcome.order_index",
    )


class LearningOutcome(Base):
    """A specific learning outcome (objective) from the TIE syllabus.

    Each subtopic has one or more specific objectives. The AI uses these to:
    - Frame tutoring responses at the correct cognitive level
    - Generate assessment questions that test the exact stated objective
    - Verify lesson content covers all required outcomes

    Cognitive levels map to Bloom's taxonomy as used in NECTA:
    - knowledge: remember, recall facts
    - comprehension: understand and explain
    - application: apply in new situations
    - analysis: break down, compare, contrast
    - evaluation: judge, assess, critique
    - synthesis: create, combine, design
    """

    __tablename__ = "learning_outcomes"
    __table_args__ = (Index("ix_learning_outcome_subtopic", "subtopic_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    subtopic_id: Mapped[str] = mapped_column(ForeignKey("syllabus_subtopics.id"), nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # e.g. "Identify the place value of each digit in base ten numeration"
    cognitive_level: Mapped[str] = mapped_column(String, default="comprehension")  # Bloom's level
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    subtopic: Mapped[SyllabusSubtopic] = relationship("SyllabusSubtopic", back_populates="outcomes")
