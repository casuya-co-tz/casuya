from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    channel: str
    message: str
    is_read: bool
