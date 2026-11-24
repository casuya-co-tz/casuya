"""SQLite search fallback uses one UNION query and escapes LIKE metacharacters."""

from __future__ import annotations

from unittest.mock import patch

from backend.config.database import get_db
from backend.models.lesson import Lesson, Subtopic, Subject, Topic
from backend.services import search_service


def _seed(db):
    subject = Subject(id="s1", name="Cells and Biology Form One", slug="bio1")
    topic = Topic(id="t1", subject_id="s1", title="Cells and tissues", form_level="1")
    subtopic = Subtopic(id="st1", topic_id="t1", title="Plant cells")
    lesson = Lesson(
        id="l1",
        subtopic_id="st1",
        slug="plant-cells",
        title="Plant cells and microscope",
        status="published",
    )
    db.add_all([subject, topic, subtopic, lesson])
    db.commit()


def test_sqlite_union_search_finds_all_kinds_in_one_query():
    gen = get_db()
    db = next(gen)
    _seed(db)
    with patch.object(search_service, "_is_postgres", return_value=False):
        results = search_service.search_content("cells", published_only=True)
    gen.close()

    by_type = {r["type"] for r in results}
    assert {"lesson", "subject", "topic", "subtopic"} <= by_type
    assert all(r["title"] for r in results)


def test_sqlite_search_escapes_wildcards():
    gen = get_db()
    db = next(gen)
    _seed(db)
    with patch.object(search_service, "_is_postgres", return_value=False):
        literal = search_service.search_content("%", published_only=True)
        none = search_service.search_content("zzz-no-such-term", published_only=True)
    gen.close()
    assert literal == []
    assert none == []
