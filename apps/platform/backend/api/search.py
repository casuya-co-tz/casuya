from fastapi import APIRouter, Depends

from backend.middleware.auth import get_current_user
from backend.middleware.cache import cache_get, cache_set
from backend.services.search_service import search_content

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict])
def search(q: str, current_user=Depends(get_current_user)):
    # Search results are global (not per-user), so a short TTL each safe while
    # absorbing repeated keystrokes / popular queries.
    key = f"search:q:{q.strip().lower()[:120]}"
    cached = cache_get(key, ttl_seconds=60)
    if cached is not None:
        return cached
    result = search_content(q)
    cache_set(key, result, ttl=60)
    return result
