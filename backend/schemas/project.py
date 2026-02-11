from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ProjectBase(BaseModel):
    title: str
    jd_text: str
    practice_questions: Optional[List[str]] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    jd_text: Optional[str] = None
    resume_text: Optional[str] = None
    practice_questions: Optional[List[str]] = None


class ProjectResponse(ProjectBase):
    id: UUID
    user_id: UUID
    resume_text: Optional[str] = None
    resume_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
