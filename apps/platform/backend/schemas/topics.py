from pydantic import BaseModel


class TopicCreate(BaseModel):
    subject_id: str
    title: str
    form_level: str = ""


class TopicResponse(BaseModel):
    id: str
    subject_id: str
    title: str
    form_level: str
