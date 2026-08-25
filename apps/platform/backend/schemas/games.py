from pydantic import BaseModel


class GameResponse(BaseModel):
    id: str
    lesson_id: str | None
    title: str
    slug: str | None = None
    status: str = "draft"


class GameCreateHTML(BaseModel):
    lesson_id: str | None = None
    title: str
    html_content: str


class GameUpdate(BaseModel):
    title: str | None = None
    html_content: str | None = None


class GameCreate(BaseModel):
    lesson_id: str
    title: str
    questions: list[dict] = []
    options: list[dict] = []
