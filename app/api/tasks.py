"""Task REST endpoints — consumed by the web UI."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import crud

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskUpdate(BaseModel):
    stage: str | None = None
    priority: str | None = None
    brand: str | None = None
    activity_type: str | None = None
    sprint_backlog: str | None = None
    dependency: str | None = None
    deadline: str | None = None
    comments: str | None = None
    expected_story_points: int | None = None
    actual_story_points: int | None = None


@router.get("")
async def list_tasks(
    member: str | None = None,
    stage: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_tasks(db, member_name=member, stage=stage)


@router.patch("/{task_id}")
async def update_task(task_id: int, body: TaskUpdate, db: AsyncSession = Depends(get_db)):
    updated = await crud.update_task(db, task_id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated
