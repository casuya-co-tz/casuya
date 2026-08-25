"""Casuya Core lesson compilation API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.services.casuya_core_service import (
    compile_lesson,
    security_scan,
    validate_lesson_html,
)

router = APIRouter(prefix="/core", tags=["casuya-core"])


class CompileRequest(BaseModel):
    html: str
    lesson_id: str | None = None
    validate_schema: bool = True
    security: bool = True


class HtmlPayload(BaseModel):
    html: str


@router.post("/lessons/compile")
def compile_lesson_route(payload: CompileRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        return compile_lesson(
            payload.html,
            lesson_id=payload.lesson_id,
            validate=payload.validate_schema,
            security=payload.security,
            db=db,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Compilation failed: {exc}")


@router.post("/lessons/validate")
def validate_lesson_route(payload: HtmlPayload, _=Depends(get_current_user)):
    return validate_lesson_html(payload.html)


@router.post("/lessons/security-scan")
def security_scan_route(payload: HtmlPayload, _=Depends(get_current_user)):
    return security_scan(payload.html)
