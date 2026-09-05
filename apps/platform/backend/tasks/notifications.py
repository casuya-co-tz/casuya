from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.progress import ProgressRecord
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.services.notification_service import send_notification


def send_weekly_digests() -> int:
    """Send weekly digest emails to teachers. Returns count sent."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        # Batch query: teachers with their school_code
        teachers = (
            db.query(Teacher.id, Teacher.user_id, Teacher.school_code)
            .filter(Teacher.school_code.isnot(None))
            .all()
        )

        # Batch query: progress counts per student within the last week
        progress_counts = (
            db.query(
                ProgressRecord.student_id,
                func.count(ProgressRecord.id).label("recent_count"),
            )
            .filter(ProgressRecord.synced_at >= week_ago)
            .group_by(ProgressRecord.student_id)
            .all()
        )
        progress_by_student = {row.student_id: row.recent_count for row in progress_counts}

        if not progress_by_student:
            return 0

        # Batch query: students with recent progress, joined to get full_name and school_code
        active_student_ids = list(progress_by_student.keys())
        students = (
            db.query(Student.id, Student.full_name, Student.school_code)
            .filter(Student.id.in_(active_student_ids))
            .all()
        )
        students_by_id = {s.id: s for s in students}

        # Build lookup: school_code -> list of (student_name, recent_count)
        school_students: dict[str, list[tuple[str, int]]] = {}
        for student_id, recent_count in progress_by_student.items():
            student = students_by_id.get(student_id)
            if student and student.school_code:
                school_students.setdefault(student.school_code, []).append(
                    (student.full_name, recent_count)
                )

        count = 0
        for teacher in teachers:
            for student_name, recent_count in school_students.get(teacher.school_code, []):
                send_notification(
                    user_id=teacher.user_id,
                    message=f"Student {student_name} completed {recent_count} lesson(s) this week.",
                    channel="in_app",
                )
                count += 1

        return count
    finally:
        _gen.close()
