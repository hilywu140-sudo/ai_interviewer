from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class SessionBase(BaseModel):
    title: Optional[str] = None


class SessionCreate(SessionBase):
    project_id: UUID


class SessionResponse(SessionBase):
    id: UUID
    project_id: UUID
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True
