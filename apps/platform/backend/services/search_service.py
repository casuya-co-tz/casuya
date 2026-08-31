from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.database import get_db, get_engine
from backend.models.lesson import Lesson, Subject, Subtopic, Topic

_FTS_BOOKSTOP = "english"


def _is_postgres() -> bool:
    try:
        return get_engine().dialect.name == "postgresql"
    except Exception:
        return False


def search_content(query: str) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        q = (query or "").strip()
        if not q:
            return []
        results: list[dict] = []

        if _is_postgres():
            # Postgres full-text: word-boundary + stemming, and can use the
            # functional GIN index created in database.py.
            ts = func.to_tsvector(_FTS_BOOKSTOP, Lesson.title)
            lessons = (
                db.query(Lesson)
                .filter(ts.op("@@")(func.websearch_to_tsquery(_FTS_BOOKSTOP, q)))
                .limit(10)
                .all()
            )
            for l in lessons:
                results.append({"id": l.id, "type": "lesson", "title": l.title, "match": l.title})
            _fts_search(db, Subject, q, results, "subject")
            _fts_search(db, Topic, q, results, "topic")
            _fts_search(db, Subtopic, q, results, "subtopic")
        else:
            # SQLite fallback (no tsvector): substring match, same contract.
            pattern = f"%{q}%"
            for l in db.query(Lesson).filter(Lesson.title.ilike(pattern)).limit(10).all():
                results.append({"id": l.id, "type": "lesson", "title": l.title, "match": l.title})
            for s in db.query(Subject).filter(Subject.name.ilike(pattern)).limit(5).all():
                results.append({"id": s.id, "type": "subject", "title": s.name, "match": s.name})
            for t in db.query(Topic).filter(Topic.title.ilike(pattern)).limit(5).all():
                results.append({"id": t.id, "type": "topic", "title": t.title, "match": t.title})
            for st in db.query(Subtopic).filter(Subtopic.title.ilike(pattern)).limit(5).all():
                results.append({"id": st.id, "type": "subtopic", "title": st.title, "match": st.title})
        return results
    finally:
        _gen.close()


def _fts_search(db: Session, model, q: str, results: list[dict], kind: str):
    ts = func.to_tsvector(_FTS_BOOKSTOP, model.title)
    rows = (
        db.query(model)
        .filter(ts.op("@@")(func.websearch_to_tsquery(_FTS_BOOKSTOP, q)))
        .limit(5)
        .all()
    )
    for r in rows:
        results.append({"id": r.id, "type": kind, "title": r.title, "match": r.title})
