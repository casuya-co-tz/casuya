from fastapi import APIRouter, Depends

from backend.middleware.auth import get_current_user
from backend.services.search_service import search_content

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict])
def search(q: str, current_user=Depends(get_current_user)):
    return search_content(q)
