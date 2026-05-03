"""Dashboard / analytics endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/sprint-progress")
async def sprint_progress(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    all_progress = await crud.get_sprint_progress(db)
    if current_user["role"] == "member":
        member_id = current_user.get("member_id")
        return [p for p in all_progress if p["member_id"] == member_id]
    return all_progress


@router.get("/wip-summary")
async def wip_summary(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    all_wip = await crud.get_wip_summary(db)
    if current_user["role"] == "member":
        member_id = current_user.get("member_id")
        from sqlalchemy import select
        from app.db.models import Member
        result = await db.execute(select(Member).where(Member.id == member_id))
        m = result.scalar_one_or_none()
        if not m:
            return []
        return [w for w in all_wip if w["member"] == m.display_name]
    return all_wip
