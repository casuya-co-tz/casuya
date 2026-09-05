"""Classrooms: connect a teacher with students via a shareable class code.

A teacher owns exactly one classroom (with a single code). Students join by
saving that code, creating a ClassroomEnrollment row. This is the source of
truth for "which students belong to this teacher" — the teacher can then see
those students' progress, publish lessons to them, and assign work.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.user import _uuid


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    lesson_limit: Mapped[int] = mapped_column(default=2)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("code", name="uq_classroom_code"),
    )


class ClassroomEnrollment(Base):
    __tablename__ = "classroom_enrollments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    classroom_id: Mapped[str] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True, nullable=False)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("classroom_id", "student_id", name="uq_enrollment_class_student"),
    )
