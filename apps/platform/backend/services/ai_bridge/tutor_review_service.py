"""Persistent tutor review queue."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.models.tutor_review import TutorReviewItem


def enqueue_review(
    db: Session,
    *,
    question: str,
    response: str,
    user_id: str | None = None,
    lesson_id: str | None = None,
    subject_slug: str | None = None,
    format_level: str = "none",
    flagged_terms: list[str] | None = None,
    source: str = "casuya-ai",
) -> TutorReviewItem | None:
    if not response.strip() or not question.strip():
        return None
    item = TutorReviewItem(
        user_id=user_id,
        lesson_id=lesson_id,
        question=question[:4000],
        response=response[:12000],
        subject_slug=subject_slug,
        format_level=format_level,
        flagged_terms=json.dumps(flagged_terms or [])[:2000],
        source=source,
        status="pending",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_reviews(db: Session, *, status: str = "pending", limit: int = 50) -> list[TutorReviewItem]:
    q = db.query(TutorReviewItem).order_by(TutorReviewItem.created_at.desc())
    if status and status != "all":
        q = q.filter(TutorReviewItem.status == status)
    return q.limit(min(limit, 100)).all()


def resolve_review(
    db: Session,
    item_id: str,
    *,
    status: str,
    reviewer_id: str,
    notes: str | None = None,
) -> TutorReviewItem | None:
    item = db.query(TutorReviewItem).filter(TutorReviewItem.id == item_id).first()
    if not item:
        return None
    item.status = status
    item.reviewer_id = reviewer_id
    item.reviewer_notes = (notes or "")[:2000] or None
    item.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item
