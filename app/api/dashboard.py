"""Dashboard / analytics endpoints — consumed by the web UI."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import crud

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/sprint-progress")
async def sprint_progress(db: AsyncSession = Depends(get_db)):
    """Per-member sprint progress: story points actual vs expected, task counts by stage."""
    return await crud.get_sprint_progress(db)


@router.get("/wip-summary")
async def wip_summary(db: AsyncSession = Depends(get_db)):
    """WIP tasks per member — used to preview the morning summary."""
    return await crud.get_wip_summary(db)
