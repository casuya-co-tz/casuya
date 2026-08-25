from fastapi import APIRouter, Depends

from backend.middleware.auth import get_current_user
from backend.services.analytics_service import get_lesson_analytics, get_lesson_distribution, get_platform_overview

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/lessons/{lesson_id}", response_model=dict | None)
@router.get("/lessons/{lesson_id}/", response_model=dict | None)
def get_lesson_analytics_route(lesson_id: str, current_user=Depends(get_current_user)):
    return get_lesson_analytics(lesson_id)


@router.get("/overview", response_model=dict)
@router.get("/overview/", response_model=dict)
def get_platform_overview_route(current_user=Depends(get_current_user)):
    return get_platform_overview()


@router.get("/lesson-distribution", response_model=list[dict])
@router.get("/lesson-distribution/", response_model=list[dict])
def get_lesson_distribution_route(current_user=Depends(get_current_user)):
    return get_lesson_distribution()
