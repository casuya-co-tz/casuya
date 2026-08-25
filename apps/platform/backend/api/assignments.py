from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.services.assignment_service import (
    create_assignment,
    delete_assignment,
    get_assignment,
    list_assignments,
    list_submissions,
    submit_assignment,
)


class SubmitAssignmentRequest(BaseModel):
    student_id: str
    elements_json: str


router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict])
def list_assignments_route(current_user=Depends(get_current_user)):
    return list_assignments()


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
    current_user=Depends(get_current_user),
):
    if not lesson_id or not title:
        raise HTTPException(status_code=400, detail="lesson_id and title are required")
    return create_assignment(
        lesson_id=lesson_id,
        title=title,
        notes=notes,
        due_date=due_date,
        created_by=current_user["sub"],
    )


@router.delete("/{assignment_id}", dependencies=[Depends(require_role("teacher"))])
@router.delete("/{assignment_id}/", dependencies=[Depends(require_role("teacher"))])
def delete_assignment_route(assignment_id: str, current_user=Depends(get_current_user)):
    if not delete_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"status": "deleted"}


@router.post("/{assignment_id}/submit", response_model=dict)
@router.post("/{assignment_id}/submit/", response_model=dict)
def submit_assignment_route(
    assignment_id: str,
    body: SubmitAssignmentRequest,
    current_user=Depends(get_current_user),
):
    return submit_assignment(
        assignment_id=assignment_id,
        student_id=body.student_id,
        elements_json=body.elements_json,
    )


@router.get("/{assignment_id}/submissions", response_model=list[dict])
@router.get("/{assignment_id}/submissions/", response_model=list[dict])
def list_submissions_route(assignment_id: str, current_user=Depends(get_current_user)):
    return list_submissions(assignment_id)
