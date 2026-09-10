"""Teacher plan generation routes — AI-generated lesson plans and schemes of work."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.teacher_plans.models import (
    LessonPlanGenerateRequest,
    LessonPlansGenerateRequest,
    SchemeOfWorkGenerateRequest,
)
from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.services.teacher_plan_service import (
    generate_lesson_plan,
    generate_scheme_of_work,
    plan_lessons_for_subtopic,
    render_lesson_plan_html,
    render_scheme_of_work_html,
)

router = APIRouter(tags=["teacher-plans"])


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
        students_boys=req.students_boys,
        students_girls=req.students_girls,
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


@router.post("/generate/lesson-plans")
async def api_generate_lesson_plans(
    req: LessonPlansGenerateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans = plan_lessons_for_subtopic(
        subject_slug=req.subject_slug,
        form_level=req.form_level,
        topic=req.topic,
        subtopic=req.subtopic or "",
        school_name=req.school_name,
        teacher_name=req.teacher_name,
        number_of_students=req.number_of_students,
        students_boys=req.students_boys,
        students_girls=req.students_girls,
        duration_minutes=req.duration_minutes,
        period=req.period,
    )
    rendered = [render_lesson_plan_html(p) for p in plans]
    subject_label = req.subject_slug.replace("-", " ").title()
    title = f"{subject_label} — {req.topic}" + (f" — {req.subtopic}" if req.subtopic else "")
    return {
        "plans_data": plans,
        "html_renders": rendered,
        "count": len(plans),
        "title": title,
        "plan_type": "lesson_plans",
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
