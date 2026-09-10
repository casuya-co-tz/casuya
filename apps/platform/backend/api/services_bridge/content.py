"""Services Bridge — content package routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.middleware.auth import get_current_user
from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


@router.post("/content")
@router.post("/content/")
def create_content(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_content(payload))


@router.get("/content")
@router.get("/content/")
def list_content(
    status: str | None = None,
    content_type: str | None = None,
    category_id: str | None = None,
    _=Depends(get_current_user),
):
    params: dict = {}
    if status:
        params["status"] = status
    if content_type:
        params["contentType"] = content_type
    if category_id:
        params["categoryId"] = category_id
    return _guard(lambda: _bridge.list_content(params))


@router.get("/content/{content_id}")
@router.get("/content/{content_id}/")
def get_content(content_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_content(content_id))


@router.put("/content/{content_id}")
@router.put("/content/{content_id}/")
def update_content(content_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.update_content(content_id, payload))


@router.delete("/content/{content_id}")
@router.delete("/content/{content_id}/")
def delete_content(content_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.delete_content(content_id))


@router.post("/content/categories")
@router.post("/content/categories/")
def create_category(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_category(payload))


@router.get("/content/categories")
@router.get("/content/categories/")
def list_categories(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_categories())


@router.get("/content/categories/{category_id}")
@router.get("/content/categories/{category_id}/")
def get_category(category_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_category(category_id))


@router.get("/content/categories/{category_id}/children")
@router.get("/content/categories/{category_id}/children/")
def category_children(category_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_category_children(category_id))


@router.get("/content/categories/{category_id}/descendants")
@router.get("/content/categories/{category_id}/descendants/")
def category_descendants(category_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_category_descendants(category_id))


@router.delete("/content/categories/{category_id}")
@router.delete("/content/categories/{category_id}/")
def delete_category(category_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.delete_category(category_id))


@router.post("/content/tags")
@router.post("/content/tags/")
def create_tag(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_tag(payload))


@router.get("/content/tags")
@router.get("/content/tags/")
def list_tags(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_tags())


@router.get("/content/tags/popular")
@router.get("/content/tags/popular/")
def tags_popular(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.popular_tags())


@router.post("/content/{content_id}/publish")
@router.post("/content/{content_id}/publish/")
def publish_content(content_id: str, published_by: str = Query(...), _=Depends(get_current_user)):
    return _guard(lambda: _bridge.publish_content(content_id, published_by))


@router.post("/content/{content_id}/unpublish")
@router.post("/content/{content_id}/unpublish/")
def unpublish_content(content_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.unpublish_content(content_id))


@router.get("/content/{content_id}/publishing-state")
@router.get("/content/{content_id}/publishing-state/")
def publishing_state(content_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.publishing_state(content_id))


@router.post("/content/search")
@router.post("/content/search/")
def search_content(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.search_content(payload))