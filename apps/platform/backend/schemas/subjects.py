from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    slug: str


class SubjectResponse(BaseModel):
    id: str
    name: str
    slug: str
