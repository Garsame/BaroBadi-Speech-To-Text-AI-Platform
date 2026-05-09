from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LectureChatMessageDetail(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LectureChatAskRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class LectureChatAskResponse(BaseModel):
    user_message: LectureChatMessageDetail
    assistant_message: LectureChatMessageDetail
