from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.services.note_service import get_note, save_note


class NoteSaveRequest(BaseModel):
    content: str


router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/{lesson_id}", response_model=dict | None)
@router.get("/{lesson_id}/", response_model=dict | None)
def get_note_route(lesson_id: str, current_user=Depends(get_current_user)):
    return get_note(current_user["sub"], lesson_id)


@router.put("/{lesson_id}", response_model=dict)
@router.put("/{lesson_id}/", response_model=dict)
def save_note_route(lesson_id: str, body: NoteSaveRequest, current_user=Depends(get_current_user)):
    return save_note(current_user["sub"], lesson_id, body.content)
