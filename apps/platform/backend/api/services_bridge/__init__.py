"""Casuya Services Bridge API routes.

Exposes the content, exams, media, auth, analytics and search packages (hosted
by the casuya-services-bridge microservice) through the platform API. When the
bridge is unavailable the endpoints degrade gracefully to 503 so the rest of
the platform keeps working.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.services_bridge import (
    analytics,
    auth_endpoints,
    content,
    exams,
    media,
    search,
)

router = APIRouter(prefix="/services", tags=["services-bridge"])

# Include order preserves the original route registration order so path
# specificity is unchanged.
router.include_router(content.router)
router.include_router(exams.router)
router.include_router(media.router)
router.include_router(auth_endpoints.router)
router.include_router(analytics.router)
router.include_router(search.router)

__all__ = ["router", "content", "exams", "media", "auth_endpoints", "analytics", "search"]