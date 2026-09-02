"""Assignment business logic: create, list, submit, grade via blackboard steps."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.assignment import Assignment, AssignmentSubmission
from backend.models.lesson import Lesson


def create_assignment(
    lesson_id: str,
    title: str,
    notes: str | None,
    due_date: str | None,
    created_by: str,
    paper_json: str | None = None,
) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        assignment = Assignment(
            lesson_id=lesson_id,
            title=title,
            notes=notes,
            due_date=due_date,
            created_by=created_by,
            paper_json=paper_json,
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
            "has_paper": bool(paper_json),
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
        # Single join to Lesson so the per-row title lookup never becomes an
        # N+1 (one extra query per assignment). Bounded to the reportable list.
        rows = (
            db.query(Assignment, Lesson.title)
            .outerjoin(Lesson, Assignment.lesson_id == Lesson.id)
            .order_by(Assignment.created_at.desc())
            .limit(200)
            .all()
        )
        return [
            {
                "id": a.id,
                "lesson_id": a.lesson_id,
                "lesson_title": title,
                "title": a.title,
                "notes": a.notes,
                "due_date": a.due_date,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "has_paper": bool(a.paper_json),
                "paper_summary": _paper_summary(a.paper_json),
            }
            for a, title in rows
        ]
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


def update_assignment(
    assignment_id: str,
    title: str | None = None,
    lesson_id: str | None = None,
    notes: str | None = None,
    due_date: str | None = None,
    paper_json: str | None = None,
) -> dict | None:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        row = db.get(Assignment, assignment_id)
        if not row:
            return None
        if title is not None:
            row.title = title
        if lesson_id is not None:
            row.lesson_id = lesson_id
        if notes is not None:
            row.notes = notes
        if due_date is not None:
            row.due_date = due_date if due_date else None
        if paper_json is not None:
            row.paper_json = paper_json if paper_json else None
        db.commit()
        db.refresh(row)
        lesson_title = _lesson_title(db, row.lesson_id)
        return {
            "id": row.id,
            "lesson_id": row.lesson_id,
            "lesson_title": lesson_title,
            "title": row.title,
            "notes": row.notes,
            "due_date": row.due_date,
            "status": row.status,
            "has_paper": bool(row.paper_json),
            "paper_summary": _paper_summary(row.paper_json),
        }
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
        "has_paper": bool(a.paper_json),
        "paper": _parse_paper(a.paper_json),
        "paper_summary": _paper_summary(a.paper_json),
    }


def _parse_paper(paper_json: str | None) -> dict | None:
    if not paper_json:
        return None
    try:
        data = json.loads(paper_json)
        return data if isinstance(data, dict) else None
    except (ValueError, TypeError):
        return None


def _paper_summary(paper_json: str | None) -> dict | None:
    from backend.services.exam_paper_service import paper_summary

    return paper_summary(_parse_paper(paper_json))
