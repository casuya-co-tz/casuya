from pydantic import BaseModel


class ProgressSyncPayload(BaseModel):
    student_id: str
    lesson_id: str
    session_id: str
    elapsed_ms: int
    completion_percentage: float
    score_percentage: float | None = None


class ProgressResponse(BaseModel):
    id: str
    student_id: str
    lesson_id: str
    session_id: str
    elapsed_ms: int
    completion_percentage: float
    score_percentage: float | None
