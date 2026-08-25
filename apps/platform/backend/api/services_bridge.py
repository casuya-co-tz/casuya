"""Casuya Services Bridge API routes.

Exposes the content, exams, media, auth, analytics and search packages (hosted
by the casuya-services-bridge microservice) through the platform API. When the
bridge is unavailable the endpoints degrade gracefully to 503 so the rest of
the platform keeps working.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.services.services_bridge_client import get_services_bridge_client

router = APIRouter(prefix="/services", tags=["services-bridge"])
_bridge = get_services_bridge_client()


def _ok(result: Any):
    return result


def _guard(fn):
    try:
        return fn()
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))


# ─── Content ───────────────────────────────────────────────────────────────
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


# ─── Exams ─────────────────────────────────────────────────────────────────
@router.post("/exams/questions")
@router.post("/exams/questions/")
def create_question(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_question(payload))


@router.get("/exams/questions")
@router.get("/exams/questions/")
def list_questions(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_questions())


@router.get("/exams/questions/{question_id}")
@router.get("/exams/questions/{question_id}/")
def get_question(question_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_question(question_id))


@router.put("/exams/questions/{question_id}")
@router.put("/exams/questions/{question_id}/")
def update_question(question_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.update_question(question_id, payload))


@router.delete("/exams/questions/{question_id}")
@router.delete("/exams/questions/{question_id}/")
def delete_question(question_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.delete_question(question_id))


@router.post("/exams/questions/filter")
@router.post("/exams/questions/filter/")
def filter_questions(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.filter_questions(payload))


@router.post("/exams/categories")
@router.post("/exams/categories/")
def create_exam_category(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_exam_category(payload))


@router.get("/exams/categories")
@router.get("/exams/categories/")
def list_exam_categories(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_exam_categories())


@router.post("/exams/tags")
@router.post("/exams/tags/")
def create_exam_tag(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_exam_tag(payload))


@router.get("/exams/tags")
@router.get("/exams/tags/")
def list_exam_tags(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_exam_tags())


@router.post("/exams")
@router.post("/exams/")
def create_exam(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.create_exam(payload))


@router.get("/exams")
@router.get("/exams/")
def list_exams(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.list_exams())


@router.get("/exams/{exam_id}")
@router.get("/exams/{exam_id}/")
def get_exam(exam_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_exam(exam_id))


@router.post("/exams/{exam_id}/publish")
@router.post("/exams/{exam_id}/publish/")
def publish_exam(exam_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.publish_exam(exam_id))


@router.post("/exams/{exam_id}/sections")
@router.post("/exams/{exam_id}/sections/")
def add_exam_section(exam_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.add_exam_section(exam_id, payload))


@router.post("/exams/{exam_id}/autofill")
@router.post("/exams/{exam_id}/autofill/")
def autofill_section(
    exam_id: str, section_id: str = Query(...), criteria: dict | None = None, _=Depends(get_current_user)
):
    return _guard(lambda: _bridge.autofill_section(exam_id, section_id, criteria))


@router.post("/exams/schedule")
@router.post("/exams/schedule/")
def schedule_exam(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.schedule_exam(payload))


@router.get("/exams/schedule/upcoming")
@router.get("/exams/schedule/upcoming/")
def upcoming_exams(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.upcoming_exams())


@router.post("/exams/sessions")
@router.post("/exams/sessions/")
def start_session(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.start_session(payload))


@router.post("/exams/sessions/{session_id}/submit")
@router.post("/exams/sessions/{session_id}/submit/")
def submit_answer(session_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.submit_answer(session_id, payload))


@router.post("/exams/sessions/{session_id}/complete")
@router.post("/exams/sessions/{session_id}/complete/")
def complete_session(session_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.complete_session(session_id))


@router.post("/exams/grade")
@router.post("/exams/grade/")
def grade_exam(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.grade(payload))


@router.post("/exams/reports/{report_type}")
@router.post("/exams/reports/{report_type}/")
def exam_report(report_type: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.exam_report(report_type, payload))


@router.post("/exams/certificates")
@router.post("/exams/certificates/")
def generate_certificate(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.generate_certificate(payload))


@router.post("/exams/certificates/verify")
@router.post("/exams/certificates/verify/")
def verify_certificate(verification_code: str = Query(...), _=Depends(get_current_user)):
    return _guard(lambda: _bridge.verify_certificate(verification_code))


@router.post("/exams/analytics")
@router.post("/exams/analytics/")
def exam_analytics(exam_id: str = Query(...), _=Depends(get_current_user)):
    return _guard(lambda: _bridge.exam_analytics(exam_id))


@router.post("/exams/security")
@router.post("/exams/security/")
def exam_security(action: str = Query(...), payload: dict | None = None, _=Depends(get_current_user)):
    payload = payload or {}
    return _guard(lambda: _bridge.exam_security(action, payload))


# ─── Media ─────────────────────────────────────────────────────────────────
@router.post("/media/upload")
@router.post("/media/upload/")
def upload_media(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.upload_media(payload))


@router.get("/media")
@router.get("/media/")
def list_media(lesson_id: str | None = None, school_id: str | None = None, _=Depends(get_current_user)):
    params: dict = {}
    if lesson_id:
        params["lessonId"] = lesson_id
    if school_id:
        params["schoolId"] = school_id
    return _guard(lambda: _bridge.list_media(params))


@router.get("/media/{media_id}")
@router.get("/media/{media_id}/")
def get_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.get_media(media_id))


@router.delete("/media/{media_id}")
@router.delete("/media/{media_id}/")
def delete_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.delete_media(media_id))


@router.get("/media/{media_id}/deliver")
@router.get("/media/{media_id}/deliver/")
def deliver_media(media_id: str, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.deliver_media(media_id))


@router.post("/media/{media_id}/thumbnail")
@router.post("/media/{media_id}/thumbnail/")
def media_thumbnail(media_id: str, payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.media_thumbnail(media_id, payload))


@router.get("/media/stats")
@router.get("/media/stats/")
def media_stats(_=Depends(get_current_user)):
    return _guard(lambda: _bridge.media_stats())


@router.post("/media/search")
@router.post("/media/search/")
def search_media(payload: dict, _=Depends(get_current_user)):
    return _guard(lambda: _bridge.search_media(payload))


# ─── Auth (bridge) ─────────────────────────────────────────────────────────
@router.post("/auth/register")
@router.post("/auth/register/")
def bridge_register(payload: dict):
    return _guard(lambda: _bridge.register_user(payload))


@router.post("/auth/login")
@router.post("/auth/login/")
def bridge_login(payload: dict):
    return _guard(lambda: _bridge.login(payload.get("email", ""), payload.get("password", "")))


@router.post("/auth/verify")
@router.post("/auth/verify/")
def bridge_verify(token: str = Query(...)):
    return _guard(lambda: _bridge.verify_token(token))


@router.post("/auth/permission")
@router.post("/auth/permission/")
def bridge_permission(payload: dict):
    return _guard(lambda: _bridge.check_permission(payload))


@router.get("/auth/roles/{user_id}")
@router.get("/auth/roles/{user_id}/")
def bridge_roles(user_id: str):
    return _guard(lambda: _bridge.get_user_roles(user_id))


@router.post("/auth/policy")
@router.post("/auth/policy/")
def bridge_policy(payload: dict):
    return _guard(lambda: _bridge.create_policy(payload))


# ─── Analytics ─────────────────────────────────────────────────────────────
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


# ─── Search ─────────────────────────────────────────────────────────────────
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
