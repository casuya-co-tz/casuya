from pydantic import BaseModel


class SubtopicCreate(BaseModel):
    topic_id: str
    title: str


class SubtopicResponse(BaseModel):
    id: str
    topic_id: str
    title: str
