from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.schemas.games import GameCreate, GameCreateHTML, GameResponse, GameUpdate
from backend.services.game_service import (
    create_game_from_html,
    delete_game,
    get_game,
    get_games_for_lesson,
    list_games,
    publish_game,
    read_game_content,
    update_game,
)

router = APIRouter(prefix="/games", tags=["games"])


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict])
def list_games_route(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return list_games(db)


@router.get("/{game_id}", response_model=dict)
@router.get("/{game_id}/", response_model=dict)
def get_game_route(game_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    game = get_game(db, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("/{game_id}/content")
@router.get("/{game_id}/content/")
def get_game_content_route(game_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    game = get_game(db, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    slug = game.get("slug")
    if not slug:
        raise HTTPException(status_code=404, detail="Game has no HTML content")
    html = read_game_content(db, slug)
    if html is None:
        raise HTTPException(status_code=404, detail="Game content not found")
    return HTMLResponse(content=html)


@router.get("/by-lesson/{lesson_id}", response_model=list[dict])
@router.get("/by-lesson/{lesson_id}/", response_model=list[dict])
def get_games_for_lesson_route(lesson_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_games_for_lesson(db, lesson_id)


@router.post("/from-html", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.post("/from-html/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def create_game_from_html_route(body: GameCreateHTML, db: Session = Depends(get_db)):
    return create_game_from_html(db, lesson_id=body.lesson_id, title=body.title, html=body.html_content)


@router.post("/{game_id}/publish", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.post("/{game_id}/publish/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def publish_game_route(game_id: str, db: Session = Depends(get_db)):
    try:
        return publish_game(db, game_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{game_id}", dependencies=[Depends(require_role("admin"))])
@router.delete("/{game_id}/", dependencies=[Depends(require_role("admin"))])
def delete_game_route(game_id: str, db: Session = Depends(get_db)):
    try:
        return delete_game(db, game_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{game_id}", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.put("/{game_id}/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def update_game_route(game_id: str, body: GameUpdate, db: Session = Depends(get_db)):
    try:
        return update_game(db, game_id=game_id, title=body.title, html=body.html_content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.post("/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def create_game_route(body: GameCreate, db: Session = Depends(get_db)):
    from backend.services.game_service import create_structured_game

    return create_structured_game(
        db, lesson_id=body.lesson_id, title=body.title, questions=body.questions, options=body.options
    )
