from sqlalchemy import func, literal_column, text
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
            # Single UNION ALL query instead of 4 sequential queries
            tsq = func.websearch_to_tsquery(_FTS_BOOKSTOP, q)
            union_sql = text("""
                (SELECT id, 'lesson' as kind, title, title as match FROM lessons
                 WHERE to_tsvector(:config, title) @@ :tsq LIMIT 10)
                UNION ALL
                (SELECT id, 'subject' as kind, name as title, name as match FROM subjects
                 WHERE to_tsvector(:config, name) @@ :tsq LIMIT 5)
                UNION ALL
                (SELECT id, 'topic' as kind, title, title as match FROM topics
                 WHERE to_tsvector(:config, title) @@ :tsq LIMIT 5)
                UNION ALL
                (SELECT id, 'subtopic' as kind, title, title as match FROM subtopics
                 WHERE to_tsvector(:config, title) @@ :tsq LIMIT 5)
            """)
            rows = db.execute(union_sql, {"config": _FTS_BOOKSTOP, "tsq": tsq}).fetchall()
            for r in rows:
                results.append({"id": r.id, "type": r.kind, "title": r.title, "match": r.match})
        else:
            # SQLite fallback: 4 parallel-ish ILIKE queries (still 4 round trips but lightweight)
            pattern = f"%{q}%"
            for l in db.query(Lesson.id, Lesson.title).filter(Lesson.title.ilike(pattern)).limit(10).all():
                results.append({"id": l.id, "type": "lesson", "title": l.title, "match": l.title})
            for s in db.query(Subject.id, Subject.name).filter(Subject.name.ilike(pattern)).limit(5).all():
                results.append({"id": s.id, "type": "subject", "title": s.name, "match": s.name})
            for t in db.query(Topic.id, Topic.title).filter(Topic.title.ilike(pattern)).limit(5).all():
                results.append({"id": t.id, "type": "topic", "title": t.title, "match": t.title})
            for st in db.query(Subtopic.id, Subtopic.title).filter(Subtopic.title.ilike(pattern)).limit(5).all():
                results.append({"id": st.id, "type": "subtopic", "title": st.title, "match": st.title})
        return results
    finally:
        _gen.close()
