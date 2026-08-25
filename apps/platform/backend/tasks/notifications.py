from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.progress import ProgressRecord
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.services.notification_service import send_notification


def send_weekly_digests():
    _gen = get_db()
    db: Session = next(_gen)
    try:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        teachers = db.query(Teacher).all()
        count = 0
        for teacher in teachers:
            students = db.query(Student).filter(Student.school_code == teacher.school_code).all()
            for student in students:
                recent = (
                    db.query(ProgressRecord)
                    .filter(
                        ProgressRecord.student_id == student.id,
                        ProgressRecord.synced_at >= week_ago,
                    )
                    .count()
                )
                if recent > 0:
                    send_notification(
                        user_id=teacher.user_id,
                        message=f"Student {student.full_name} completed {recent} lesson(s) this week.",
                        channel="in_app",
                    )
                    count += 1
        return count
    finally:
        _gen.close()
