"""Task REST endpoints — consumed by the web UI."""

import re
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import Member, Task, Workspace
from app.adapters.teams import TeamsAdapter

logger = logging.getLogger(__name__)

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


def _workspace_id_for(user: dict) -> int | None:
    """Return workspace_id filter: None = all (super_admin), int = scoped."""
    role = user.get("role")
    if role == "super_admin":
        return None
    return user.get("workspace_id") or 1


def _extract_mentions(text: str) -> list[str]:
    """Extract @mentions from text (e.g., @Harshil, @Krishna Tank Intern)."""
    if not text:
        return []
    # Match @word or @word word (name with spaces, up to 3 words)
    pattern = r'@([A-Za-z][A-Za-z\s]*)'
    matches = re.findall(pattern, text)
    return [m.strip() for m in matches]


@router.get("")
async def list_tasks(
    member: str | None = None,
    stage: str | None = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    # Members can only see their own tasks
    role = current_user["role"]
    if role == "member":
        member_id = current_user.get("member_id")
        if not member_id:
            return []
        tasks = await crud.get_tasks_for_member(db, member_id)
        # Enrich with member name and apply stage filter
        result = await db.execute(select(Member).where(Member.id == member_id))
        m = result.scalar_one_or_none()
        name = m.display_name if m else ""
        for t in tasks:
            t["member_name"] = name
        if stage:
            tasks = [t for t in tasks if t["stage"] == stage]
        return tasks

    workspace_id = _workspace_id_for(current_user)
    return await crud.list_tasks(db, member_name=member, stage=stage, workspace_id=workspace_id)


@router.patch("/{task_id}")
async def update_task(
    task_id: int,
    body: TaskUpdate,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    role = current_user["role"]

    if role == "member":
        member_id = current_user.get("member_id")
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task or task.member_id != member_id:
            raise HTTPException(status_code=403, detail="You can only update your own tasks")
    elif role == "manager":
        # Managers can only update tasks in their workspace
        workspace_id = current_user.get("workspace_id") or 1
        result = await db.execute(
            select(Task).join(Member, Task.member_id == Member.id)
            .where(Task.id == task_id, Member.workspace_id == workspace_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Task not in your workspace")

    updated = await crud.update_task(db, task_id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # ── Send to Teams if comment has mentions ──
    if body.comments:
        logger.info(f"Comment updated for task {task_id}: {body.comments[:100]}")
        mentions = _extract_mentions(body.comments)
        logger.info(f"Extracted mentions: {mentions}")
        
        if mentions:
            try:
                # Get the task and member info
                result = await db.execute(
                    select(Task, Member).join(Member, Task.member_id == Member.id)
                    .where(Task.id == task_id)
                )
                task_row, member = result.first()
                if not task_row or not member:
                    logger.warning(f"Task {task_id} or member not found when sending Teams message")
                    return updated

                logger.info(f"Found task: {task_row.sprint_backlog}, member: {member.display_name}")

                # Get workspace for Teams adapter
                ws_result = await db.execute(
                    select(Workspace).where(Workspace.id == member.workspace_id)
                )
                workspace = ws_result.scalar_one_or_none()
                if not workspace:
                    logger.warning(f"Workspace {member.workspace_id} not found for Teams adapter")
                    return updated

                logger.info(f"Workspace: {workspace.name}, Teams chat ID: {workspace.teams_agile_chat_id}")

                # Build Teams message with task details and comment
                mentioned_names = ", ".join([f"@{m}" for m in mentions])
                html_msg = f"""
                <div style="margin: 10px 0; padding: 12px; border-left: 3px solid #7c3aed; background: #f3f0ff; border-radius: 4px;">
                    <p style="margin: 0 0 8px 0; color: #7c3aed; font-weight: bold;">💬 New Comment on Task</p>
                    <p style="margin: 4px 0;"><b>Task:</b> {task_row.sprint_backlog}</p>
                    <p style="margin: 4px 0;"><b>Assigned to:</b> {member.display_name}</p>
                    <p style="margin: 4px 0;"><b>Mentioned:</b> {mentioned_names}</p>
                    <p style="margin: 4px 0;"><b>Comment:</b> {task_row.comments}</p>
                    <p style="margin: 4px 0;"><b>Stage:</b> {task_row.stage} | <b>Priority:</b> {task_row.priority}</p>
                </div>
                """

                logger.info(f"Sending Teams message to workspace {member.workspace_id}")
                # Send to Teams
                adapter = TeamsAdapter.from_workspace(workspace)
                await adapter.send_message(html_msg)
                logger.info(f"✅ Teams message sent for task {task_id} with mentions: {mentions}")
            except Exception as e:
                logger.error(f"❌ Failed to send Teams message for task {task_id}: {str(e)}", exc_info=True)
                # Don't fail the API call, just log it
        else:
            logger.info(f"No mentions found in comment for task {task_id}")

    return updated
