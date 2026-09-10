"""Services Bridge — search package routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.middleware.auth import get_current_user
from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


@router.post("/search/index")
@router.post("/search/index/")
def search_index(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.index_document(payload))


@router.post("/search/index-batch")
@router.post("/search/index-batch/")
def search_index_batch(documents: list | None = None, _=Depends(get_current_user)):
    documents = documents or []
    return _guard(lambda: _bridge.index_documents(documents))


@router.delete("/search/{doc_id}")
@router.delete("/search/{doc_id}/")
def search_remove(doc_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.remove_document(doc_id))


@router.post("/search/query")
@router.post("/search/query/")
def search_query(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.search(payload))


@router.get("/search/suggestions")
@router.get("/search/suggestions/")
def search_suggestions(q: str = Query(...), _=Depends(get_current_user)):
    return _guard(lambda: _bridge.suggestions(q))


@router.get("/search/recommendations/{user_id}")
@router.get("/search/recommendations/{user_id}/")
def search_recommendations(user_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.recommendations(user_id))


@router.post("/search/interaction")
@router.post("/search/interaction/")
def search_interaction(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.record_interaction(payload))


@router.get("/search/stats")
@router.get("/search/stats/")
def search_stats(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.search_stats())