from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import json

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.student import Student
from backend.services import exam_paper_service
from backend.services.ai_service import generate_exam_paper
from backend.services.assignment_service import (
    create_assignment,
    delete_assignment,
    get_assignment,
    list_assignments,
    list_submissions,
    submit_assignment,
    update_assignment,
)


class SubmitAssignmentRequest(BaseModel):
    student_id: str
    elements_json: str


class GeneratePaperRequest(BaseModel):
    lesson_id: str
    kind: str = "internal"
    duration: str | None = None
    sections: list[dict] | None = None


router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict])
def list_assignments_route(current_user=Depends(get_current_user)):
    return list_assignments()


@router.get("/exam-presets", response_model=dict)
@router.get("/exam-presets/", response_model=dict)
def exam_presets_route(form_level: int | None = None, current_user=Depends(get_current_user)):
    return exam_paper_service.presets(form_level)


@router.get("/{assignment_id}", response_model=dict)
@router.get("/{assignment_id}/", response_model=dict)
def get_assignment_route(assignment_id: str, current_user=Depends(get_current_user)):
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.post("", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.post("/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def create_assignment_route(
    lesson_id: str,
    title: str,
    notes: str | None = None,
    due_date: str | None = None,
    paper: str | None = None,
    current_user=Depends(get_current_user),
):
    if not lesson_id or not title:
        raise HTTPException(status_code=400, detail="lesson_id and title are required")
    paper_json = None
    if paper:
        try:
            paper_json = exam_paper_service.repair_paper(json.loads(paper))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="paper is not valid JSON")
        paper_json = json.dumps(paper_json)
    return create_assignment(
        lesson_id=lesson_id,
        title=title,
        notes=notes,
        due_date=due_date,
        created_by=current_user["sub"],
        paper_json=paper_json,
    )


@router.post("/generate-paper", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.post("/generate-paper/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
async def generate_paper_route(body: GeneratePaperRequest, current_user=Depends(get_current_user)):
    ctx = exam_paper_service.resolve_lesson_context(body.lesson_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Lesson not found")

    kind, duration, spec = exam_paper_service.build_spec(body.kind, body.sections, body.duration)
    paper, generator = await generate_exam_paper(ctx, kind, spec, duration)

    ok, issues = exam_paper_service.validate_paper(paper)
    return {
        "paper": paper,
        "generator": generator,
        "valid": ok,
        "issues": issues,
        "context": {
            "lesson_id": ctx["lesson_id"],
            "lesson_title": ctx["lesson_title"],
            "subject": ctx["subject_name"],
            "subject_slug": ctx["subject_slug"],
            "form_level": ctx["form_level"],
            "topic": ctx["topic_title"] or ctx["subtopic_title"],
        },
    }


@router.delete("/{assignment_id}", dependencies=[Depends(require_role("teacher"))])
@router.delete("/{assignment_id}/", dependencies=[Depends(require_role("teacher"))])
def delete_assignment_route(assignment_id: str, current_user=Depends(get_current_user)):
    if not delete_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"status": "deleted"}


@router.put("/{assignment_id}", response_model=dict, dependencies=[Depends(require_role("teacher"))])
@router.put("/{assignment_id}/", response_model=dict, dependencies=[Depends(require_role("teacher"))])
def update_assignment_route(
    assignment_id: str,
    title: str | None = None,
    lesson_id: str | None = None,
    notes: str | None = None,
    due_date: str | None = None,
    paper: str | None = None,
    current_user=Depends(get_current_user),
):
    paper_json = None
    if paper:
        try:
            paper_json = exam_paper_service.repair_paper(json.loads(paper))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="paper is not valid JSON")
        paper_json = json.dumps(paper_json)
    result = update_assignment(
        assignment_id=assignment_id,
        title=title,
        lesson_id=lesson_id,
        notes=notes,
        due_date=due_date,
        paper_json=paper_json,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return result


@router.post("/{assignment_id}/submit", response_model=dict)
@router.post("/{assignment_id}/submit/", response_model=dict)
def submit_assignment_route(
    assignment_id: str,
    body: SubmitAssignmentRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = current_user.get("role", "")
    student_id = body.student_id
    if role == "student":
        # Students may only submit as themselves.
        student = db.query(Student).filter(Student.user_id == current_user["sub"]).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        student_id = student.id
    return submit_assignment(
        assignment_id=assignment_id,
        student_id=student_id,
        elements_json=body.elements_json,
    )


@router.get("/{assignment_id}/submissions", response_model=list[dict], dependencies=[Depends(require_role("admin", "teacher"))])
@router.get("/{assignment_id}/submissions/", response_model=list[dict], dependencies=[Depends(require_role("admin", "teacher"))])
def list_submissions_route(assignment_id: str, current_user=Depends(get_current_user)):
    return list_submissions(assignment_id)
