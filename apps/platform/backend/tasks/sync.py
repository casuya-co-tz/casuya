from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.progress import ProgressRecord


def run_pending_sync_reconciliation():
    _gen = get_db()
    db: Session = next(_gen)
    try:
        pending = db.query(ProgressRecord).filter(ProgressRecord.completion_percentage < 0).all()
        for record in pending:
            record.completion_percentage = max(record.completion_percentage, 0.0)
        db.commit()
        return len(pending)
    finally:
        _gen.close()
