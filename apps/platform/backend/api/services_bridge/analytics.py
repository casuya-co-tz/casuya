"""Services Bridge — analytics package routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.middleware.auth import get_current_user
from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


@router.post("/analytics/ingest")
@router.post("/analytics/ingest/")
def analytics_ingest(metric: str = Query(...), value: dict | None = None, _=Depends(get_current_user)):
    value = value or {}
    return _guard(lambda: _bridge.ingest_metric(metric, value))


@router.post("/analytics/aggregate")
@router.post("/analytics/aggregate/")
def analytics_aggregate(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.aggregate(payload))


@router.post("/analytics/event")
@router.post("/analytics/event/")
def analytics_event(event: str = Query(...), data: dict | None = None, _=Depends(get_current_user)):
    data = data or {}
    return _guard(lambda: _bridge.emit_event(event, data))


@router.post("/analytics/metric")
@router.post("/analytics/metric/")
def analytics_metric(value: dict | None = None, _=Depends(get_current_user)):
    value = value or {}
    return _guard(lambda: _bridge.record_metric(value))


@router.post("/analytics/predict")
@router.post("/analytics/predict/")
def analytics_predict(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.predict(payload))


@router.post("/analytics/query")
@router.post("/analytics/query/")
def analytics_query(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.build_query(payload))


@router.post("/analytics/report")
@router.post("/analytics/report/")
def analytics_report(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.build_report(payload))


@router.get("/analytics/stats")
@router.get("/analytics/stats/")
def analytics_stats_route(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.analytics_stats())