from pydantic import BaseModel


class SearchResult(BaseModel):
    id: str
    type: str
    title: str
    match: str
