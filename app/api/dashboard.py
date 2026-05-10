"""Dashboard / analytics endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import Member

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/sprint-progress")
async def sprint_progress(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    role = current_user["role"]
    if role == "super_admin":
        raise HTTPException(status_code=403, detail="Super admin does not have access to sprint data")

    if role == "member":
        member_id = current_user.get("member_id")
        all_progress = await crud.get_sprint_progress(db)
        return [p for p in all_progress if p["member_id"] == member_id]

    workspace_id = current_user.get("workspace_id") or 1
    return await crud.get_sprint_progress(db, workspace_id=workspace_id)


@router.get("/wip-summary")
async def wip_summary(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    role = current_user["role"]
    if role == "super_admin":
        raise HTTPException(status_code=403, detail="Super admin does not have access to WIP data")

    if role == "member":
        member_id = current_user.get("member_id")
        result = await db.execute(select(Member).where(Member.id == member_id))
        m = result.scalar_one_or_none()
        if not m:
            return []
        all_wip = await crud.get_wip_summary(db)
        return [w for w in all_wip if w["member"] == m.display_name]

    workspace_id = current_user.get("workspace_id") or 1
    return await crud.get_wip_summary(db, workspace_id=workspace_id)
