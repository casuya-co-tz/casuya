from pydantic import BaseModel


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


class PlanResponse(BaseModel):
    id: str
    plan_type: str
    title: str
    subject_slug: str
    subject_name: str | None
    form_level: int
    topic: str
    subtopic: str | None
    term: str | None
    language: str
    created_at: str
    updated_at: str


class PlanDetailResponse(PlanResponse):
    plan_data: str
    html_render: str | None
