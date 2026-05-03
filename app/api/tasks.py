"""Task REST endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_manager
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
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    # Members can only see their own tasks
    if current_user["role"] == "member":
        member_id = current_user.get("member_id")
        if not member_id:
            return []
        tasks = await crud.get_tasks_for_member(db, member_id)
        # Enrich with member name and apply stage filter
        from sqlalchemy import select
        from app.db.models import Member
        result = await db.execute(select(Member).where(Member.id == member_id))
        m = result.scalar_one_or_none()
        name = m.display_name if m else ""
        for t in tasks:
            t["member_name"] = name
        if stage:
            tasks = [t for t in tasks if t["stage"] == stage]
        return tasks

    return await crud.list_tasks(db, member_name=member, stage=stage)


@router.patch("/{task_id}")
async def update_task(
    task_id: int,
    body: TaskUpdate,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    # Members can only update their own tasks
    if current_user["role"] == "member":
        member_id = current_user.get("member_id")
        from sqlalchemy import select
        from app.db.models import Task
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task or task.member_id != member_id:
            raise HTTPException(status_code=403, detail="You can only update your own tasks")

    updated = await crud.update_task(db, task_id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated
