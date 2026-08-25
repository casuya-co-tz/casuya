from pydantic import BaseModel


class LessonAnalyticsResponse(BaseModel):
    lesson_id: str
    session_count: int
    avg_completion_percentage: float
    avg_score_percentage: float


class OverviewResponse(BaseModel):
    total_students: int
    total_lessons: int
    total_sessions: int
    avg_completion_rate: float
