"""Services Bridge — exams package routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.middleware.auth import get_current_user
from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


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