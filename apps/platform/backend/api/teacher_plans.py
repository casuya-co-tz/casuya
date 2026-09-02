"""Teacher plan endpoints — generate, save, list, export lesson plans and schemes of work."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.models.teacher import Teacher
from backend.models.teacher_plan import TeacherPlan
from backend.services.teacher_plan_service import (
    generate_lesson_plan,
    generate_scheme_of_work,
    render_lesson_plan_html,
    render_scheme_of_work_html,
)

router = APIRouter(prefix="/teacher-plans", tags=["teacher-plans"])


def _get_teacher_id(user: dict, db: Session) -> str:
    uid = user.get("sub")
    teacher = db.query(Teacher).filter(Teacher.user_id == uid).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return teacher.id


class LessonPlanGenerateRequest(BaseModel):
    subject_slug: str
    form_level: int
    topic: str
    subtopic: str | None = None
    school_name: str | None = None
    teacher_name: str | None = None
    number_of_students: int | None = None
    duration_minutes: int = 40
    period: str | None = None


class SchemeOfWorkGenerateRequest(BaseModel):
    subject_slug: str
    form_level: int
    term: str
    academic_year: str | None = None
    school_name: str | None = None
    teacher_name: str | None = None
    topics: list[str] | None = None


class PlanSaveRequest(BaseModel):
    plan_type: str
    title: str
    subject_slug: str
    subject_name: str | None = None
    form_level: int
    topic: str
    subtopic: str | None = None
    term: str | None = None
    plan_data: str
    html_render: str | None = None
    language: str = "en"


# ── Generate ───────────────────────────────────────────────────────────────


@router.post("/generate/lesson-plan")
async def api_generate_lesson_plan(
    req: LessonPlanGenerateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = await generate_lesson_plan(
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        topic=req.topic,
        subtopic=req.subtopic,
        school_name=req.school_name,
        teacher_name=req.teacher_name,
        number_of_students=req.number_of_students,
        duration_minutes=req.duration_minutes,
        period=req.period,
    )
    html = render_lesson_plan_html(plan)
    title = f"{req.topic}" + (f" — {req.subtopic}" if req.subtopic else "")
    return {
        "plan_data": plan,
        "html_render": html,
        "title": title,
        "plan_type": "lesson_plan",
    }


@router.post("/generate/scheme-of-work")
async def api_generate_scheme_of_work(
    req: SchemeOfWorkGenerateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = await generate_scheme_of_work(
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        term=req.term,
        academic_year=req.academic_year,
        school_name=req.school_name,
        teacher_name=req.teacher_name,
        topics=req.topics,
    )
    html = render_scheme_of_work_html(plan)
    subject_label = req.subject_slug.replace("-", " ").title()
    title = f"{subject_label} — {req.term}"
    return {
        "plan_data": plan,
        "html_render": html,
        "title": title,
        "plan_type": "scheme_of_work",
    }


# ── CRUD ───────────────────────────────────────────────────────────────────


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
