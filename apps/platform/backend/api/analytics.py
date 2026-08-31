from fastapi import APIRouter, Depends

from backend.middleware.auth import get_current_user
from backend.middleware.cache import cache_get, cache_set
from backend.middleware.permissions import require_role
from backend.services.analytics_service import get_lesson_analytics, get_lesson_distribution, get_platform_overview

router = APIRouter(prefix="/analytics", tags=["analytics"])

_ADMIN_TEACHER = [Depends(require_role("admin", "teacher"))]

_OVERVIEW_CACHE_KEY = "analytics:overview"
_OVERVIEW_CACHE_TTL = 60


@router.get("/lessons/{lesson_id}", response_model=dict | None, dependencies=_ADMIN_TEACHER)
@router.get("/lessons/{lesson_id}/", response_model=dict | None, dependencies=_ADMIN_TEACHER)
def get_lesson_analytics_route(lesson_id: str, current_user=Depends(get_current_user)):
    return get_lesson_analytics(lesson_id)


@router.get("/overview", response_model=dict, dependencies=_ADMIN_TEACHER)
@router.get("/overview/", response_model=dict, dependencies=_ADMIN_TEACHER)
def get_platform_overview_route(current_user=Depends(get_current_user)):
    cached = cache_get(_OVERVIEW_CACHE_KEY, _OVERVIEW_CACHE_TTL)
    if cached is not None:
        return cached
    result = get_platform_overview()
    cache_set(_OVERVIEW_CACHE_KEY, result, ttl=_OVERVIEW_CACHE_TTL)
    return result


@router.get("/lesson-distribution", response_model=list[dict], dependencies=_ADMIN_TEACHER)
@router.get("/lesson-distribution/", response_model=list[dict], dependencies=_ADMIN_TEACHER)
def get_lesson_distribution_route(current_user=Depends(get_current_user)):
    return get_lesson_distribution()
