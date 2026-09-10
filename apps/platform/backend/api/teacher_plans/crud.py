"""Teacher plan CRUD routes — save, list, get, export and delete saved plans."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from backend.api.teacher_plans.models import PlanSaveRequest
from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.models.teacher import Teacher
from backend.models.teacher_plan import TeacherPlan
from backend.services.teacher_plan_service import (
    render_lesson_plan_html,
    render_scheme_of_work_html,
)

router = APIRouter(tags=["teacher-plans"])


def _get_teacher_id(user: dict, db: Session) -> str:
    uid = user.get("sub")
    teacher = db.query(Teacher).filter(Teacher.user_id == uid).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return teacher.id


def _plan_dict(p: TeacherPlan) -> dict:
    return {
        "id": p.id,
        "plan_type": p.plan_type,
        "title": p.title,
        "subject_slug": p.subject_slug,
        "subject_name": p.subject_name,
        "form_level": p.form_level,
        "topic": p.topic,
        "subtopic": p.subtopic,
        "term": p.term,
        "language": p.language,
        "created_at": p.created_at.isoformat() if p.created_at else "",
        "updated_at": p.updated_at.isoformat() if p.updated_at else "",
    }


def _plan_detail_dict(p: TeacherPlan) -> dict:
    d = _plan_dict(p)
    d["plan_data"] = p.plan_data
    d["html_render"] = p.html_render
    return d


@router.post("/save")
def api_save_plan(
    req: PlanSaveRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = _get_teacher_id(user, db)
    plan = TeacherPlan(
        teacher_id=teacher_id,
        plan_type=req.plan_type,
        title=req.title,
        subject_slug=req.subject_slug,
        subject_name=req.subject_name,
        form_level=req.form_level,
        topic=req.topic,
        subtopic=req.subtopic,
        term=req.term,
        plan_data=req.plan_data,
        html_render=req.html_render,
        language=req.language,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_dict(plan)


@router.get("/list")
def api_list_plans(
    plan_type: str | None = None,
    subject_slug: str | None = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = _get_teacher_id(user, db)
    q = db.query(TeacherPlan).filter(TeacherPlan.teacher_id == teacher_id)
    if plan_type:
        q = q.filter(TeacherPlan.plan_type == plan_type)
    if subject_slug:
        q = q.filter(TeacherPlan.subject_slug == subject_slug)
    plans = q.order_by(TeacherPlan.created_at.desc()).limit(50).all()
    return [_plan_dict(p) for p in plans]


@router.get("/{plan_id}")
def api_get_plan(
    plan_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = _get_teacher_id(user, db)
    plan = (
        db.query(TeacherPlan)
        .filter(TeacherPlan.id == plan_id, TeacherPlan.teacher_id == teacher_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _plan_detail_dict(plan)


@router.get("/{plan_id}/export")
def api_export_plan(
    plan_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = _get_teacher_id(user, db)
    plan = (
        db.query(TeacherPlan)
        .filter(TeacherPlan.id == plan_id, TeacherPlan.teacher_id == teacher_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.html_render:
        return HTMLResponse(content=plan.html_render)
    data = json.loads(plan.plan_data)
    if plan.plan_type == "scheme_of_work":
        html = render_scheme_of_work_html(data)
    else:
        html = render_lesson_plan_html(data)
    return HTMLResponse(content=html)


@router.delete("/{plan_id}")
def api_delete_plan(
    plan_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = _get_teacher_id(user, db)
    plan = (
        db.query(TeacherPlan)
        .filter(TeacherPlan.id == plan_id, TeacherPlan.teacher_id == teacher_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}
