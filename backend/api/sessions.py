from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from database import get_db
from models import Session as SessionModel, Project, User
from schemas import SessionCreate, SessionResponse
from dependencies.auth import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
def create_session(
    session: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new practice session"""
    # Verify project belongs to current user
    project = db.query(Project).filter(
        Project.id == session.project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_session = SessionModel(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("", response_model=List[SessionResponse])
def list_sessions(
    project_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List sessions, optionally filtered by project_id"""
    # Get all project IDs belonging to current user
    user_project_ids = db.query(Project.id).filter(
        Project.user_id == current_user.id
    ).all()
    user_project_ids = [p[0] for p in user_project_ids]

    query = db.query(SessionModel).filter(
        SessionModel.project_id.in_(user_project_ids)
    )

    if project_id:
        if project_id not in user_project_ids:
            raise HTTPException(status_code=404, detail="Project not found")
        query = query.filter(SessionModel.project_id == project_id)

    sessions = query.order_by(SessionModel.started_at.desc()).all()
    return sessions


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific session"""
    # Join with Project to verify ownership
    session = db.query(SessionModel).join(Project).filter(
        SessionModel.id == session_id,
        Project.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a session"""
    # Join with Project to verify ownership
    db_session = db.query(SessionModel).join(Project).filter(
        SessionModel.id == session_id,
        Project.user_id == current_user.id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(db_session)
    db.commit()
    return {"message": "Session deleted successfully"}
