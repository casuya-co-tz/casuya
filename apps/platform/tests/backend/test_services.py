import pytest

from backend.config.database import get_db
from backend.models.lesson import Subject, Topic, Subtopic, Lesson
from backend.services.auth_service import register_user, authenticate_user
from backend.services.lesson_service import create_lesson_from_html, publish_lesson, get_lesson, list_lessons
from backend.services.quiz_service import create_quiz, get_quiz_for_lesson, grade_attempt
from backend.services.progress_service import apply_progress_sync, get_student_progress
from backend.services.search_service import search_content
from backend.services.analytics_service import recompute_lesson_snapshot, get_platform_overview, get_lesson_distribution
from sqlalchemy.orm import Session


def _create_test_subtopic():
    db: Session = next(get_db())
    subj = Subject(name="Physics", slug="physics")
    db.add(subj)
    db.flush()
    topic = Topic(subject_id=subj.id, title="Mechanics", form_level="III")
    db.add(topic)
    db.flush()
    st = Subtopic(topic_id=topic.id, title="Forces")
    db.add(st)
    db.flush()
    db.commit()
    return st.id


def test_auth_flow():
    result = register_user("svc@test.com", "pass123", "Svc User", "student")
    assert "access_token" in result
    assert result["role"] == "student"
    login = authenticate_user("svc@test.com", "pass123")
    assert login["user_id"] == result["user_id"]


def test_lesson_flow():
    st_id = _create_test_subtopic()
    result = create_lesson_from_html(st_id, "Test Lesson", "<p>Hello</p>")
    assert result["status"] == "draft"
    published = publish_lesson(result["id"])
    assert published["status"] == "published"
    fetched = get_lesson(result["id"])
    assert fetched is not None
    lesson_list = list_lessons()
    assert len(lesson_list) >= 1


def test_quiz_flow():
    db: Session = next(get_db())
    st_id = _create_test_subtopic()
    lesson_result = create_lesson_from_html(st_id, "Quiz Lesson", "<p>Quiz</p>")
    lesson_id = lesson_result["id"]
    publish_lesson(lesson_id)
    result = create_quiz(db, lesson_id, "Physics Quiz", [
        {"prompt": "What is force?", "options": [
            {"text": "Mass x Acceleration", "is_correct": True},
            {"text": "Speed", "is_correct": False},
        ]},
    ])
    assert result["id"] is not None
    quiz = get_quiz_for_lesson(db, lesson_id)
    assert quiz is not None
    questions = quiz["questions"]
    if questions:
        correct_id = None
        for opt in questions[0]["options"]:
            if correct_id is None:
                correct_id = opt["id"]
        if correct_id:
            result = grade_attempt(db, quiz["id"], {questions[0]["id"]: correct_id})
            assert result["score"] == 1


def test_progress():
    result = apply_progress_sync("test-student", {
        "lesson_id": "test-lesson",
        "session_id": "sess-1",
        "elapsed_ms": 5000,
        "completion_percentage": 75.0,
    })
    assert result["status"] == "synced"
    records = get_student_progress("test-student")
    assert len(records) >= 1


def test_search():
    results = search_content("test")
    assert isinstance(results, list)


def test_analytics():
    overview = get_platform_overview()
    assert "total_students" in overview
    assert "total_lessons" in overview


def test_lesson_distribution_grouped_by_subject():
    db: Session = next(get_db())
    subj = Subject(name="Biology", slug="biology-test")
    db.add(subj)
    db.flush()
    topic = Topic(subject_id=subj.id, title="Cells", form_level="I")
    db.add(topic)
    db.flush()
    subtopic = Subtopic(topic_id=topic.id, title="Intro")
    db.add(subtopic)
    db.flush()
    lesson = Lesson(subtopic_id=subtopic.id, slug="cells-intro-test", title="Cells Intro", status="published")
    db.add(lesson)
    db.commit()

    dist = get_lesson_distribution()
    assert isinstance(dist, list)
    bio = next((d for d in dist if d["subject"] == "Biology"), None)
    assert bio is not None, "published lesson should appear under its subject"
    assert bio["count"] >= 1
    assert "avg_completion_percentage" in bio
