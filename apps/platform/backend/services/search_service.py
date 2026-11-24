from sqlalchemy import func, text
from sqlalchemy.orm import Session

from backend.config.database import get_db, get_engine

_FTS_BOOKSTOP = "english"

_is_postgres_cache = None


def _is_postgres() -> bool:
    global _is_postgres_cache
    if _is_postgres_cache is None:
        try:
            _is_postgres_cache = get_engine().dialect.name == "postgresql"
        except Exception:
            _is_postgres_cache = False
    return _is_postgres_cache


def search_content(query: str, *, published_only: bool = False) -> list[dict]:
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
            lesson_filter = " AND status = 'published'" if published_only else ""
            union_sql = text(f"""
                (SELECT id, 'lesson' as kind, title, title as match FROM lessons
                 WHERE to_tsvector(:config, title) @@ :tsq{lesson_filter} LIMIT 10)
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
            # SQLite fallback: one UNION ALL round trip instead of four.
            # Escape LIKE metacharacters so a user typing '%' does not turn the
            # search into a full-table scan.
            escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            lesson_filter = " AND status = 'published'" if published_only else ""
            union_sql = text(f"""
                SELECT * FROM (SELECT id, 'lesson' AS kind, title, title AS match FROM lessons
                 WHERE title LIKE :pattern ESCAPE '\\'{lesson_filter} LIMIT 10)
                UNION ALL
                SELECT * FROM (SELECT id, 'subject' AS kind, name AS title, name AS match FROM subjects
                 WHERE name LIKE :pattern ESCAPE '\\' LIMIT 5)
                UNION ALL
                SELECT * FROM (SELECT id, 'topic' AS kind, title, title AS match FROM topics
                 WHERE title LIKE :pattern ESCAPE '\\' LIMIT 5)
                UNION ALL
                SELECT * FROM (SELECT id, 'subtopic' AS kind, title, title AS match FROM subtopics
                 WHERE title LIKE :pattern ESCAPE '\\' LIMIT 5)
            """)
            rows = db.execute(union_sql, {"pattern": pattern}).fetchall()
            for r in rows:
                results.append({"id": r.id, "type": r.kind, "title": r.title, "match": r.match})
        return results
    finally:
        _gen.close()
