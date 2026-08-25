from pydantic import BaseModel


class LessonCreate(BaseModel):
    subtopic_id: str
    title: str
    slug: str
    html_content: str


class LessonUpdate(BaseModel):
    title: str | None = None
    html_content: str | None = None


class LessonResponse(BaseModel):
    id: str
    subtopic_id: str
    slug: str
    title: str
    content_hash: str | None
    package_version: str | None
    status: str
