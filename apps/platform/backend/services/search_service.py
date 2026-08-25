from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson, Subject, Subtopic, Topic


def search_content(query: str) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        results = []
        pattern = f"%{query}%"
        lessons = db.query(Lesson).filter(Lesson.title.ilike(pattern)).limit(10).all()
        for l in lessons:
            results.append({"id": l.id, "type": "lesson", "title": l.title, "match": l.title})
        subjects = db.query(Subject).filter(Subject.name.ilike(pattern)).limit(5).all()
        for s in subjects:
            results.append({"id": s.id, "type": "subject", "title": s.name, "match": s.name})
        topics = db.query(Topic).filter(Topic.title.ilike(pattern)).limit(5).all()
        for t in topics:
            results.append({"id": t.id, "type": "topic", "title": t.title, "match": t.title})
        subtopics = db.query(Subtopic).filter(Subtopic.title.ilike(pattern)).limit(5).all()
        for st in subtopics:
            results.append({"id": st.id, "type": "subtopic", "title": st.title, "match": st.title})
        return results
    finally:
        _gen.close()
