from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.schemas.quizzes import QuizCreate, QuizCreateHTML, QuizResult, QuizSubmission, QuizUpdate
from backend.services.quiz_service import (
    create_quiz,
    create_quiz_from_html,
    delete_quiz,
    get_quiz,
    get_quiz_for_lesson,
    grade_attempt,
    list_quizzes,
    publish_quiz,
    read_quiz_content,
    update_quiz,
)

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("")
@router.get("/")
def list_quizzes_route(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return list_quizzes(db, offset=offset, limit=limit)


@router.get("/{quiz_id}")
@router.get("/{quiz_id}/")
def get_quiz_route(quiz_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.get("/{quiz_id}/content")
@router.get("/{quiz_id}/content/")
def get_quiz_content_route(quiz_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    slug = quiz.get("slug")
    if not slug:
        raise HTTPException(status_code=404, detail="Quiz has no HTML content")
    html = read_quiz_content(db, slug)
    if html is None:
        raise HTTPException(status_code=404, detail="Quiz content not found")
    return HTMLResponse(content=html)


@router.get("/by-lesson/{lesson_id}")
@router.get("/by-lesson/{lesson_id}/")
def get_quiz_for_lesson_route(lesson_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    quiz = get_quiz_for_lesson(db, lesson_id)
    return quiz


@router.post("", dependencies=[Depends(require_role("admin"))])
@router.post("/", dependencies=[Depends(require_role("admin"))])
def create_quiz_route(body: QuizCreate, db: Session = Depends(get_db)):
    return create_quiz(db, lesson_id=body.lesson_id, title=body.title, questions=body.questions)


@router.post("/from-html", dependencies=[Depends(require_role("admin"))])
@router.post("/from-html/", dependencies=[Depends(require_role("admin"))])
def create_quiz_from_html_route(body: QuizCreateHTML, db: Session = Depends(get_db)):
    return create_quiz_from_html(db, lesson_id=body.lesson_id, title=body.title, html=body.html_content)


@router.post("/{quiz_id}/publish", dependencies=[Depends(require_role("admin"))])
@router.post("/{quiz_id}/publish/", dependencies=[Depends(require_role("admin"))])
def publish_quiz_route(quiz_id: str, db: Session = Depends(get_db)):
    try:
        return publish_quiz(db, quiz_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{quiz_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{quiz_id}/", dependencies=[Depends(require_role("admin"))])
def delete_quiz_route(quiz_id: str, db: Session = Depends(get_db)):
    try:
        return delete_quiz(db, quiz_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{quiz_id}", dependencies=[Depends(require_role("admin"))])
@router.put("/{quiz_id}/", dependencies=[Depends(require_role("admin"))])
def update_quiz_route(quiz_id: str, body: QuizUpdate, db: Session = Depends(get_db)):
    try:
        return update_quiz(db, quiz_id=quiz_id, title=body.title, html=body.html_content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{quiz_id}/submit", response_model=QuizResult)
@router.post("/{quiz_id}/submit/", response_model=QuizResult)
def submit_quiz_attempt(
    quiz_id: str,
    body: QuizSubmission,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return grade_attempt(db, quiz_id=quiz_id, answers=body.answers, work=body.work)
