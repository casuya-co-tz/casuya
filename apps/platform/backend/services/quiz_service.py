import hashlib
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config.settings import get_settings
from backend.models.quiz import Quiz, QuizOption, QuizQuestion

settings = get_settings()


def _get_quiz_pkg_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "quiz-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"


def create_quiz(db: Session, lesson_id: str, title: str, questions: list[dict]) -> dict:
    quiz = Quiz(lesson_id=lesson_id, title=title)
    db.add(quiz)
    db.flush()
    for q_data in questions:
        question = QuizQuestion(quiz_id=quiz.id, prompt=q_data["prompt"])
        db.add(question)
        db.flush()
        for opt in q_data.get("options", []):
            option = QuizOption(question_id=question.id, text=opt["text"], is_correct=opt.get("is_correct", False))
            db.add(option)
    db.commit()
    return {"id": quiz.id, "lesson_id": lesson_id, "title": title}


def create_quiz_from_html(db: Session, lesson_id: str | None, title: str, html: str) -> dict:
    slug = title.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:8]
    content_hash = hashlib.sha256(html.encode()).hexdigest()
    quiz = Quiz(lesson_id=lesson_id, title=title, slug=slug, package_html=html, content_hash=content_hash)
    db.add(quiz)
    db.flush()
    pkg_path = _get_quiz_pkg_path(slug)
    pkg_path.parent.mkdir(parents=True, exist_ok=True)
    pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": quiz.id, "slug": slug, "title": title, "content_hash": content_hash, "status": "draft"}


def list_quizzes(
    db: Session,
    offset: int = 0,
    limit: int = 50,
    max_limit: int = 100,
) -> dict:
    limit = min(limit, max_limit)
    total = db.query(func.count(Quiz.id)).scalar()
    quizzes = db.query(Quiz).offset(offset).limit(limit).all()
    counts = dict(db.query(QuizQuestion.quiz_id, func.count(QuizQuestion.id)).group_by(QuizQuestion.quiz_id).all())
    return {
        "items": [
            {
                "id": q.id,
                "lesson_id": q.lesson_id,
                "title": q.title,
                "slug": q.slug,
                "status": q.status,
                "content_hash": q.content_hash,
                "question_count": counts.get(q.id, 0),
            }
            for q in quizzes
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + limit < total,
    }


def get_quiz(db: Session, quiz_id: str) -> dict | None:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        return None

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()

    if not questions:
        return {
            "id": quiz.id,
            "lesson_id": quiz.lesson_id,
            "title": quiz.title,
            "slug": quiz.slug,
            "content_hash": quiz.content_hash,
            "status": quiz.status,
            "questions": [],
        }

    question_ids = [q.id for q in questions]
    all_options = db.query(QuizOption).filter(QuizOption.question_id.in_(question_ids)).all()

    options_map: dict[str, list] = {}
    for opt in all_options:
        if opt.question_id not in options_map:
            options_map[opt.question_id] = []
        options_map[opt.question_id].append({"id": opt.id, "text": opt.text})

    return {
        "id": quiz.id,
        "lesson_id": quiz.lesson_id,
        "title": quiz.title,
        "slug": quiz.slug,
        "content_hash": quiz.content_hash,
        "status": quiz.status,
        "questions": [
            {
                "id": q.id,
                "prompt": q.prompt,
                "options": options_map.get(q.id, []),
            }
            for q in questions
        ],
    }


def get_quiz_for_lesson(db: Session, lesson_id: str) -> dict | None:
    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson_id).first()
    if not quiz:
        return None

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()

    if not questions:
        return {
            "id": quiz.id,
            "lesson_id": quiz.lesson_id,
            "title": quiz.title,
            "questions": [],
        }

    question_ids = [q.id for q in questions]
    all_options = db.query(QuizOption).filter(QuizOption.question_id.in_(question_ids)).all()

    options_map: dict[str, list] = {}
    for opt in all_options:
        if opt.question_id not in options_map:
            options_map[opt.question_id] = []
        options_map[opt.question_id].append({"id": opt.id, "text": opt.text})

    return {
        "id": quiz.id,
        "lesson_id": quiz.lesson_id,
        "title": quiz.title,
        "questions": [
            {
                "id": q.id,
                "prompt": q.prompt,
                "options": options_map.get(q.id, []),
            }
            for q in questions
        ],
    }


def read_quiz_content(db: Session, slug: str) -> str | None:
    quiz = db.query(Quiz).filter(Quiz.slug == slug).first()
    if quiz and quiz.package_html:
        return quiz.package_html
    pkg_path = _get_quiz_pkg_path(slug)
    if pkg_path.exists():
        return pkg_path.read_text(encoding="utf-8")
    return None


def publish_quiz(db: Session, quiz_id: str) -> dict:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise ValueError("Quiz not found")
    quiz.status = "published"
    db.commit()
    return {"id": quiz.id, "slug": quiz.slug, "status": "published"}


def delete_quiz(db: Session, quiz_id: str) -> dict:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise ValueError("Quiz not found")
    slug = quiz.slug
    db.delete(quiz)
    db.commit()
    if slug:
        pkg_path = _get_quiz_pkg_path(slug)
        if pkg_path.exists():
            pkg_path.unlink()
    return {"detail": "Quiz deleted"}


def update_quiz(db: Session, quiz_id: str, title: str | None = None, html: str | None = None) -> dict:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise ValueError("Quiz not found")
    if title is not None:
        quiz.title = title
    if html is not None:
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        quiz.content_hash = content_hash
        quiz.package_html = html
        pkg_path = _get_quiz_pkg_path(quiz.slug)
        pkg_path.parent.mkdir(parents=True, exist_ok=True)
        pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": quiz.id, "slug": quiz.slug, "title": quiz.title, "status": quiz.status}


def grade_attempt(db: Session, quiz_id: str, answers: dict, work: dict | None = None) -> dict:
    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).all()

    if not questions:
        return {"quiz_id": quiz_id, "score": 0, "total": 0, "percentage": 0}

    question_ids = [q.id for q in questions]
    correct_options = (
        db.query(QuizOption)
        .filter(
            QuizOption.question_id.in_(question_ids),
            QuizOption.is_correct.is_(True),
        )
        .all()
    )

    correct_map = {opt.question_id: opt.id for opt in correct_options}

    total = len(questions)
    correct = 0
    for q in questions:
        correct_option_id = correct_map.get(q.id)
        if correct_option_id and answers.get(q.id) == correct_option_id:
            correct += 1

    percentage = (correct / total * 100) if total > 0 else 0

    work_score = None
    work_percentage = None
    combined_percentage = None
    if work is not None:
        work_score = 0
        for q in questions:
            snap = work.get(q.id) or work.get(str(q.id))
            has = False
            if isinstance(snap, dict):
                if (
                    snap.get("hasWork") is True
                    or (isinstance(snap.get("elements"), list) and len(snap["elements"]) > 0)
                    or (
                        isinstance(snap.get("recognizedLatex"), str)
                        and snap["recognizedLatex"].strip()
                        not in (
                            "",
                            "__drawing__",
                        )
                    )
                    or snap.get("recognizedLatex") == "__drawing__"
                    or (isinstance(snap.get("elements_json"), str) and len(snap["elements_json"].strip()) > 4)
                ):
                    has = True
            elif (isinstance(snap, list) and len(snap) > 0) or snap is True:
                has = True
            if has:
                work_score += 1

        work_percentage = round((work_score / total * 100) if total > 0 else 0, 2)
        combined_percentage = round(percentage * 0.7 + work_percentage * 0.3, 2) if total > 0 else round(percentage, 2)
        return {
            "quiz_id": quiz_id,
            "score": correct,
            "total": total,
            "percentage": round(percentage, 2),
            "work_score": work_score,
            "work_total": total,
            "work_percentage": work_percentage,
            "combined_percentage": combined_percentage,
        }

    return {"quiz_id": quiz_id, "score": correct, "total": total, "percentage": round(percentage, 2)}
