"""Assignment business logic: create, list, submit, grade via blackboard steps."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.assignment import Assignment, AssignmentSubmission
from backend.models.lesson import Lesson


def create_assignment(lesson_id: str, title: str, notes: str | None, due_date: str | None, created_by: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        assignment = Assignment(
            lesson_id=lesson_id,
            title=title,
            notes=notes,
            due_date=due_date,
            created_by=created_by,
        )
        db.add(assignment)
        db.commit()
        return {
            "id": assignment.id,
            "lesson_id": lesson_id,
            "title": title,
            "notes": notes,
            "due_date": due_date,
            "status": assignment.status,
        }
    finally:
        _gen.close()


def _lesson_title(db: Session, lesson_id: str) -> str | None:
    if not lesson_id:
        return None
    lesson = db.get(Lesson, lesson_id)
    return lesson.title if lesson else None


def list_assignments() -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        rows = db.query(Assignment).order_by(Assignment.created_at.desc()).all()
        return [_to_dict(a, db) for a in rows]
    finally:
        _gen.close()


def get_assignment(assignment_id: str) -> dict | None:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        row = db.get(Assignment, assignment_id)
        return _to_dict(row, db) if row else None
    finally:
        _gen.close()


def delete_assignment(assignment_id: str) -> bool:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        row = db.get(Assignment, assignment_id)
        if not row:
            return False
        db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == assignment_id).delete(
            synchronize_session=False
        )
        db.delete(row)
        db.commit()
        return True
    finally:
        _gen.close()


def submit_assignment(assignment_id: str, student_id: str, elements_json: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        submission = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=student_id,
            elements_json=elements_json,
        )
        db.add(submission)
        db.commit()
        return {
            "id": submission.id,
            "assignment_id": assignment_id,
            "student_id": student_id,
            "status": submission.status,
        }
    finally:
        _gen.close()


def list_submissions(assignment_id: str) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        rows = db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id == assignment_id).all()
        return [
            {
                "id": s.id,
                "assignment_id": s.assignment_id,
                "student_id": s.student_id,
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in rows
        ]
    finally:
        _gen.close()


def _to_dict(a: Assignment, db: Session | None = None) -> dict:
    return {
        "id": a.id,
        "lesson_id": a.lesson_id,
        "lesson_title": _lesson_title(db, a.lesson_id) if db else None,
        "title": a.title,
        "notes": a.notes,
        "due_date": a.due_date,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
