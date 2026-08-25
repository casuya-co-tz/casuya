from pydantic import BaseModel


class QuizCreate(BaseModel):
    lesson_id: str | None = None
    title: str
    questions: list[dict] = []


class QuizCreateHTML(BaseModel):
    lesson_id: str | None = None
    title: str
    html_content: str


class QuizUpdate(BaseModel):
    title: str | None = None
    html_content: str | None = None


class QuizResponse(BaseModel):
    id: str
    lesson_id: str | None
    title: str
    slug: str | None = None
    status: str = "draft"


class QuizSubmission(BaseModel):
    answers: dict[str, str]
    # Optional show-your-work payload: { questionId: { elements, hasWork, recognizedLatex } }
    work: dict | None = None


class QuizResult(BaseModel):
    quiz_id: str
    score: int
    total: int
    percentage: float
    # Work breakdown (presence-based grading) — null when no work sent
    work_score: int | None = None
    work_total: int | None = None
    work_percentage: float | None = None
    combined_percentage: float | None = None
